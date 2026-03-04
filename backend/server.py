from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, auth, messaging
import os
import logging
import json
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Initialize Firebase Admin
cred = credentials.Certificate(str(ROOT_DIR / 'firebase-service-account.json'))
firebase_admin.initialize_app(cred)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create geospatial index
async def init_db():
    # Create 2dsphere index for geospatial queries
    await db.incidents.create_index([("location", "2dsphere")])
    await db.users.create_index([("location", "2dsphere")])
    await db.users.create_index([("firebase_uid", 1)], unique=True)
    logging.info("Database indexes created")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logging.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logging.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logging.error(f"Error broadcasting to WebSocket: {e}")

manager = ConnectionManager()

# Create the main app
app = FastAPI(title="ShieldNet API")
api_router = APIRouter(prefix="/api")

# Models
class UserCreate(BaseModel):
    firebase_uid: str
    email: str
    display_name: Optional[str] = None
    fcm_token: Optional[str] = None

class UserLocation(BaseModel):
    latitude: float
    longitude: float
    fcm_token: Optional[str] = None

class IncidentCreate(BaseModel):
    incident_type: str  # theft, fire, medical, assault, accident, other
    description: str
    latitude: float
    longitude: float
    severity: str = "medium"  # low, medium, high, critical

class IncidentResponse(BaseModel):
    id: str
    user_id: str
    incident_type: str
    description: str
    location: Dict[str, Any]
    severity: str
    status: str
    created_at: datetime
    updated_at: datetime

class HotspotResponse(BaseModel):
    location: Dict[str, Any]
    count: int
    incident_types: List[str]
    severity_avg: str

# Auth dependency
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split('Bearer ')[1]
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logging.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")

# Routes
@api_router.get("/")
async def root():
    return {"message": "ShieldNet API v1.0", "status": "running"}

@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    """Register a new user with Firebase UID"""
    try:
        # Check if user already exists
        existing_user = await db.users.find_one({"firebase_uid": user_data.firebase_uid})
        if existing_user:
            return {"message": "User already exists", "user_id": str(existing_user["_id"])}
        
        user_dict = {
            "firebase_uid": user_data.firebase_uid,
            "email": user_data.email,
            "display_name": user_data.display_name,
            "fcm_token": user_data.fcm_token,
            "location": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.users.insert_one(user_dict)
        return {"message": "User registered successfully", "user_id": str(result.inserted_id)}
    except Exception as e:
        logging.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/user/location")
async def update_user_location(location_data: UserLocation, current_user: dict = Depends(get_current_user)):
    """Update user's current location for proximity alerts"""
    try:
        location_point = {
            "type": "Point",
            "coordinates": [location_data.longitude, location_data.latitude]
        }
        
        update_data = {
            "location": location_point,
            "updated_at": datetime.utcnow()
        }
        
        if location_data.fcm_token:
            update_data["fcm_token"] = location_data.fcm_token
        
        await db.users.update_one(
            {"firebase_uid": current_user["uid"]},
            {"$set": update_data}
        )
        
        return {"message": "Location updated successfully"}
    except Exception as e:
        logging.error(f"Error updating location: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/incidents")
async def create_incident(incident: IncidentCreate, current_user: dict = Depends(get_current_user)):
    """Create a new incident and trigger proximity alerts"""
    try:
        # Get user info
        user = await db.users.find_one({"firebase_uid": current_user["uid"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create incident
        incident_dict = {
            "user_id": current_user["uid"],
            "incident_type": incident.incident_type,
            "description": incident.description,
            "location": {
                "type": "Point",
                "coordinates": [incident.longitude, incident.latitude]
            },
            "severity": incident.severity,
            "status": "active",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.incidents.insert_one(incident_dict)
        incident_id = str(result.inserted_id)
        
        # Broadcast to WebSocket clients
        await manager.broadcast({
            "type": "new_incident",
            "data": {
                "id": incident_id,
                "incident_type": incident.incident_type,
                "severity": incident.severity,
                "latitude": incident.latitude,
                "longitude": incident.longitude,
                "created_at": datetime.utcnow().isoformat()
            }
        })
        
        # Find nearby users (within 5km = 5000 meters)
        nearby_users = await db.users.find({
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [incident.longitude, incident.latitude]
                    },
                    "$maxDistance": 5000  # 5km in meters
                }
            },
            "fcm_token": {"$exists": True, "$ne": None},
            "firebase_uid": {"$ne": current_user["uid"]}  # Don't notify the reporter
        }).to_list(100)
        
        # Send FCM notifications to nearby users
        if nearby_users:
            asyncio.create_task(send_proximity_alerts(nearby_users, incident))
        
        return {
            "message": "Incident reported successfully",
            "incident_id": incident_id,
            "nearby_users_notified": len(nearby_users)
        }
    except Exception as e:
        logging.error(f"Error creating incident: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def send_proximity_alerts(users: List[dict], incident: IncidentCreate):
    """Send FCM notifications to nearby users"""
    try:
        tokens = [user["fcm_token"] for user in users if user.get("fcm_token")]
        
        if not tokens:
            return
        
        severity_emoji = {
            "low": "ℹ️",
            "medium": "⚠️",
            "high": "🚨",
            "critical": "🔴"
        }
        
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=f"{severity_emoji.get(incident.severity, '⚠️')} {incident.incident_type.title()} Alert Nearby",
                body=f"{incident.description[:100]}... - Check your map for details"
            ),
            data={
                "incident_type": incident.incident_type,
                "severity": incident.severity,
                "latitude": str(incident.latitude),
                "longitude": str(incident.longitude)
            },
            tokens=tokens
        )
        
        response = messaging.send_multicast(message)
        logging.info(f"Successfully sent {response.success_count} notifications, {response.failure_count} failed")
    except Exception as e:
        logging.error(f"Error sending FCM notifications: {e}")

@api_router.get("/incidents")
async def get_incidents(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius: Optional[int] = None,  # in meters
    status: Optional[str] = "active",
    limit: int = 100
):
    """Get incidents, optionally filtered by location"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        if latitude and longitude and radius:
            query["location"] = {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [longitude, latitude]
                    },
                    "$maxDistance": radius
                }
            }
        
        incidents = await db.incidents.find(query).sort("created_at", -1).limit(limit).to_list(limit)
        
        return [{
            "id": str(incident["_id"]),
            "user_id": incident["user_id"],
            "incident_type": incident["incident_type"],
            "description": incident["description"],
            "latitude": incident["location"]["coordinates"][1],
            "longitude": incident["location"]["coordinates"][0],
            "severity": incident["severity"],
            "status": incident["status"],
            "created_at": incident["created_at"].isoformat()
        } for incident in incidents]
    except Exception as e:
        logging.error(f"Error fetching incidents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/incidents/nearby")
async def get_nearby_incidents(
    latitude: float,
    longitude: float,
    radius: int = 5000,  # default 5km
    current_user: dict = Depends(get_current_user)
):
    """Get incidents near a specific location"""
    return await get_incidents(latitude, longitude, radius)

@api_router.get("/hotspots")
async def get_hotspots(radius: int = 1000, min_incidents: int = 3):
    """Get incident hotspots using geospatial aggregation"""
    try:
        # Aggregate incidents by approximate location (rounded to ~100m grid)
        pipeline = [
            {"$match": {"status": "active"}},
            {
                "$group": {
                    "_id": {
                        "lat": {"$round": [{"$arrayElemAt": ["$location.coordinates", 1]}, 2]},
                        "lng": {"$round": [{"$arrayElemAt": ["$location.coordinates", 0]}, 2]}
                    },
                    "count": {"$sum": 1},
                    "incident_types": {"$addToSet": "$incident_type"},
                    "severities": {"$push": "$severity"},
                    "incidents": {"$push": {
                        "id": {"$toString": "$_id"},
                        "type": "$incident_type",
                        "severity": "$severity"
                    }}
                }
            },
            {"$match": {"count": {"$gte": min_incidents}}},
            {"$sort": {"count": -1}},
            {"$limit": 50}
        ]
        
        hotspots = await db.incidents.aggregate(pipeline).to_list(50)
        
        return [{
            "latitude": hotspot["_id"]["lat"],
            "longitude": hotspot["_id"]["lng"],
            "count": hotspot["count"],
            "incident_types": hotspot["incident_types"],
            "incidents": hotspot["incidents"]
        } for hotspot in hotspots]
    except Exception as e:
        logging.error(f"Error fetching hotspots: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time incident updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and receive messages
            data = await websocket.receive_text()
            # Echo back or handle client messages if needed
            logging.info(f"Received WebSocket message: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logging.info("WebSocket client disconnected")
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await init_db()
    logger.info("ShieldNet API started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("Database connection closed")
