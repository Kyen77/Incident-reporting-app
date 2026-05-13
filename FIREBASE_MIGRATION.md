# Firebase Integration Migration Guide

## Overview
This project has been successfully migrated from a custom Python backend (FastAPI + MongoDB) to **Firebase as the backend**. This simplifies deployment, reduces infrastructure costs, and provides better scalability.

## What Changed

### Architecture Before
```
Frontend (React Native) 
  → HTTP API calls 
  → Python Backend (FastAPI)
    → MongoDB
    → Firebase Auth (only)
    → Firebase Cloud Messaging (FCM)
```

### Architecture After
```
Frontend (React Native)
  → Firebase SDK (Firestore, Auth)
  → Firebase Cloud Functions (backend logic)
  → Firestore (database)
  → Firebase Cloud Messaging (FCM)
```

## Key Changes

### 1. **Database: MongoDB → Firestore**
   - User data stored in Firestore instead of MongoDB
   - Incidents stored in Firestore collection
   - Real-time listeners replace WebSocket connections

### 2. **API Backend: Custom FastAPI → Cloud Functions**
   - Proximity alert logic moved to Cloud Functions
   - FCM notifications triggered by Cloud Functions
   - Hotspot aggregation moved to Cloud Functions

### 3. **Frontend Communication**
   - **Before**: HTTP REST calls to `BACKEND_URL`
   - **After**: Direct Firestore SDK calls + Cloud Functions callable functions

### 4. **Real-time Updates**
   - **Before**: WebSocket connection
   - **After**: Firestore real-time listeners (built-in)

## Frontend Updates

### API Service (`frontend/services/api.js`)
Now uses Firebase SDK directly:
```javascript
import { getFirestore, collection, addDoc, query, onSnapshot } from 'firebase/firestore';

// Creates incident in Firestore
const createIncident = async (userId, incidentData) => { ... }

// Real-time incident subscriptions
const subscribeToIncidents = (lat, lng, radiusKm, callback) => { ... }

// Calls Cloud Functions
const getNearbyIncidents = httpsCallable(functions, 'getNearbyIncidents');
```

### Screen Updates
- **report.tsx**: Uses `createIncident()` directly
- **map.tsx**: Uses `subscribeToIncidents()` for real-time updates
- **alerts.tsx**: Uses `subscribeToIncidents()` + `updateUserLocation()`
- **profile.tsx**: Uses Cloud Function `getHotspots()`

## Cloud Functions

Located in `functions/src/index.ts`:

1. **onIncidentCreated** - Triggered when incident added to Firestore
   - Finds nearby users
   - Sends FCM notifications

2. **getNearbyIncidents** - Callable function
   - Returns incidents within specified radius

3. **getHotspots** - Callable function  
   - Aggregates incidents into hotspots
   - Returns top incident areas

4. **updateUserLocation** - Callable function
   - Updates user location in Firestore
   - Stores FCM token

## Firestore Data Structure

### `users/{uid}`
```javascript
{
  uid: string,
  email: string,
  displayName: string,
  fcmToken: string,
  location: {
    latitude: number,
    longitude: number,
    geoHash: string,
    lastUpdated: timestamp
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `incidents/{incidentId}`
```javascript
{
  userId: string,
  incidentType: string,
  description: string,
  latitude: number,
  longitude: number,
  geoHash: string,
  severity: string,
  status: string, // "active", "resolved"
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Firestore Security Rules

See `firestore.rules`:
- Active incidents readable by anyone (for map view)
- Users can only read/write their own data
- Only Cloud Functions can write to hotspots

## How to Deploy

### 1. Set up Firebase Project
```bash
npm install -g firebase-tools
firebase login
firebase init functions
```

### 2. Update firebase.json
Replace `YOUR_PROJECT_ID` with your actual Firebase project ID:
```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### 3. Deploy Cloud Functions
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 4. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 5. Frontend Configuration
Ensure `.env` file in `frontend/` has Firebase config:
```
EXPO_PUBLIC_FIREBASE_API_KEY=xxx
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
EXPO_PUBLIC_FIREBASE_APP_ID=xxx
```

## Removed Components

### Backend (`backend/` directory)
No longer needed:
- `server.py` - Can be deleted
- `requirements.txt` - Can be deleted
- `MongoDB` connection - Not used

You can delete the entire `backend/` directory.

## Performance Improvements

1. **Latency**: Direct SDK calls are faster than HTTP requests
2. **Real-time**: Firestore listeners are more efficient than WebSocket
3. **Cost**: Pay-as-you-go model for Cloud Functions
4. **Scalability**: Firestore handles millions of concurrent connections
5. **Maintenance**: No server infrastructure to manage

## Troubleshooting

### Proximity Alerts Not Working
- Check Cloud Function logs: `firebase functions:log`
- Verify user has FCM token set in Firestore
- Check Firestore security rules

### Incidents Not Appearing
- Check browser console for errors
- Verify Firestore rules allow read access
- Ensure `status` field is "active"

### Cloud Functions Timing Out
- Check function memory allocation
- Review geospatial query performance
- Consider implementing pagination

## Migration Checklist

- [x] Updated API service to use Firestore
- [x] Updated all frontend screens
- [x] Created Cloud Functions
- [x] Configured Firestore security rules
- [ ] Deploy Cloud Functions to Firebase
- [ ] Test all features
- [ ] Update documentation
- [ ] Delete old backend directory
- [ ] Update deployment procedures

## Next Steps

1. **Deploy**: Follow "How to Deploy" section
2. **Test**: Test all app features
3. **Monitor**: Check Cloud Function logs
4. **Optimize**: Monitor Firestore usage and costs
5. **Scale**: Add indexes if needed for performance

## Cost Considerations

### Firestore Pricing (as of 2024)
- Reads: $0.06 per 100k
- Writes: $0.18 per 100k
- Deletes: $0.02 per 100k
- Stored data: $0.18 per GB

### Cloud Functions Pricing
- Per invocation: $0.40 per 1M
- Compute time: $0.000002880 per GB-second

**Free tier**: 25k reads/writes per day

## Support

For issues or questions:
1. Check Cloud Function logs
2. Review Firestore data structure
3. Verify security rules
4. Check frontend console for errors
