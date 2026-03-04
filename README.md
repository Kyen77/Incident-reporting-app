# ShieldNet - Community Safety Platform

<div align="center">
  <h3>🛡️ Real-time Incident Reporting & Proximity Alerts</h3>
  <p>A mobile-first community safety platform with live incident tracking, geospatial alerts, and hotspot analytics</p>
</div>

---

## 📱 Features

### Core Functionality
- **Incident Reporting** - Report safety incidents with GPS location
  - 6 incident types: Theft, Fire, Medical, Assault, Accident, Other
  - 4 severity levels: Low, Medium, High, Critical
  - Real-time location capture

- **Live Safety Map** - Interactive map with color-coded incident markers
  - Google Maps integration
  - Real-time incident visualization
  - "Open in Maps" functionality

- **5km Proximity Alerts** - Push notifications to nearby users
  - Automatic FCM notifications when incidents occur nearby
  - WebSocket real-time updates
  - Distance-based filtering

- **Hotspot Analytics** - Data-driven safety insights
  - Identify high-frequency incident zones
  - Aggregated incident statistics
  - Visual hotspot dashboard

- **User Authentication** - Secure Firebase authentication
  - Email/Password sign-in
  - Google Sign-in
  - Persistent sessions

---

## 🏗️ Tech Stack

### Frontend
- **React Native** (Expo) - Cross-platform mobile development
- **Expo Router** - File-based navigation
- **Firebase SDK** - Authentication
- **Socket.io Client** - Real-time updates
- **Expo Location** - GPS tracking
- **Expo Notifications** - Push notifications

### Backend
- **FastAPI** - High-performance Python web framework
- **MongoDB** - NoSQL database with geospatial indexing
- **Firebase Admin SDK** - Authentication & FCM
- **WebSocket** - Real-time communication
- **Motor** - Async MongoDB driver

### Infrastructure
- **MongoDB Atlas** - Cloud database with 2dsphere indexes
- **Firebase Cloud Messaging** - Push notifications
- **Google Maps API** - Maps & location services

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and Yarn
- Python 3.11+
- MongoDB (local or Atlas)
- Firebase project
- Google Maps API key

### 1️⃣ Clone the Repository
```bash
git clone <your-repo-url>
cd shieldnet
```

### 2️⃣ Backend Setup

#### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Configure Environment Variables
Create `backend/.env`:
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=shieldnet
```

#### Add Firebase Service Account
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Project Settings → Service Accounts
3. Generate new private key
4. Save as `backend/firebase-service-account.json`

⚠️ **Never commit this file to Git!**

#### Start Backend Server
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Backend will run at: `http://localhost:8001`

---

### 3️⃣ Frontend Setup

#### Install Dependencies
```bash
cd frontend
yarn install
```

#### Configure Environment Variables
Create `frontend/.env`:
```bash
# Backend URL
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001

# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google Maps API Key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

#### Get Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Project Settings → General → Your apps
3. Select Web app or create new one
4. Copy configuration values

#### Get Google Maps API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable these APIs:
   - Maps Embed API
   - Maps JavaScript API
   - Geocoding API
3. Create credentials → API Key
4. Copy the API key

#### Start Expo Development Server
```bash
yarn start
```

Scan QR code with:
- **iOS**: Camera app
- **Android**: Expo Go app

---

## 🗄️ Database Setup

### MongoDB Geospatial Indexes
The backend automatically creates required indexes on startup:
- `incidents` collection: 2dsphere index on `location`
- `users` collection: 2dsphere index on `location`
- `users` collection: unique index on `firebase_uid`

### GeoJSON Format
Locations are stored in GeoJSON Point format:
```json
{
  "type": "Point",
  "coordinates": [longitude, latitude]
}
```

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user

### Incidents
- `POST /api/incidents` - Create incident (triggers proximity alerts)
- `GET /api/incidents` - Get all incidents
- `GET /api/incidents/nearby` - Get incidents within radius

### User Location
- `POST /api/user/location` - Update user location & FCM token

### Analytics
- `GET /api/hotspots` - Get incident hotspots

### Real-time
- `WebSocket /api/ws` - Real-time incident updates

---

## 🔔 Push Notifications Setup

### Firebase Cloud Messaging (FCM)

1. **Enable FCM in Firebase Console**
   - Project Settings → Cloud Messaging
   - Note your Sender ID

2. **Configure app.json** (already done)
   - iOS: Add `infoPlist` permissions
   - Android: Add notification permissions

3. **Test Notifications**
   - Grant notification permissions when prompted
   - Report an incident
   - Users within 5km receive push notification

---

## 🎯 Key Technical Features

### Geospatial Queries
- MongoDB `$near` operator for proximity search
- 2dsphere indexes for efficient location queries
- 5km radius proximity detection

### Real-time Updates
- WebSocket connections for live incident broadcasting
- Automatic UI updates when new incidents reported

### FCM Integration
- Multicast messaging to nearby users
- Background notification handling
- Token management and updates

### Security
- Firebase Authentication token verification
- JWT middleware for protected routes
- Input validation on all endpoints

---

## 📱 Mobile App Structure

```
frontend/app/
├── (auth)/           # Authentication screens
│   ├── login.tsx     # Email/Google sign-in
│   └── register.tsx  # User registration
├── (tabs)/           # Main app tabs
│   ├── map.tsx       # Live incident map
│   ├── report.tsx    # Report incident form
│   ├── alerts.tsx    # Proximity alerts
│   └── profile.tsx   # User profile & hotspots
├── contexts/         # React Context providers
│   ├── AuthContext.tsx     # Firebase auth
│   └── LocationContext.tsx # GPS location
└── index.tsx         # App entry point
```

---

## 🧪 Testing

### Backend Testing
```bash
cd backend
pytest
```

### Test Backend APIs with curl
```bash
# Health check
curl http://localhost:8001/api/

# Get incidents
curl http://localhost:8001/api/incidents

# Get hotspots
curl http://localhost:8001/api/hotspots
```

---

## 🚢 Deployment

### Backend Deployment
- Deploy to any Python hosting service (Railway, Render, Heroku)
- Set environment variables in hosting platform
- Upload Firebase service account JSON securely
- Configure MongoDB Atlas connection string

### Frontend Deployment
- Build production app: `expo build:android` or `expo build:ios`
- Submit to App Store / Play Store
- Or use Expo Application Services (EAS)

---

## 🔒 Security Best Practices

1. **Never commit sensitive files:**
   - `.env` files
   - `firebase-service-account.json`
   - API keys

2. **Use environment variables** for all credentials

3. **Rotate API keys** regularly

4. **Enable Firebase App Check** for production

5. **Implement rate limiting** on API endpoints

---

## 🛠️ Troubleshooting

### Backend Issues
- **MongoDB connection error**: Check `MONGO_URL` in `.env`
- **Firebase auth error**: Verify service account JSON is valid
- **FCM notifications not sending**: Check FCM tokens are being saved

### Frontend Issues
- **Firebase auth not working**: Check Firebase API key and config
- **Location not available**: Grant location permissions
- **Push notifications not received**: Enable notification permissions
- **Map not loading**: Verify Google Maps API key

### WebSocket Issues
- **Connection rejected**: Check CORS settings in backend
- **Messages not received**: Verify WebSocket endpoint URL

---

## 📄 License

MIT License - feel free to use this project for learning or commercial purposes.

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📞 Support

For issues or questions:
- Open a GitHub issue
- Check existing issues for solutions

---

## 🎉 Acknowledgments

- Firebase for authentication and push notifications
- Google Maps for mapping services
- MongoDB for geospatial database capabilities
- Expo for cross-platform mobile development

---

<div align="center">
  <p>Built with ❤️ for community safety</p>
  <p>⭐ Star this repo if you find it useful!</p>
</div>