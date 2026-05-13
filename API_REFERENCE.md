# Firebase API Quick Reference

## Authentication

### Register User
```javascript
import { registerUser } from '../services/api';

await registerUser({
  firebase_uid: user.uid,
  email: user.email,
  display_name: user.displayName
});
```

### Login
```javascript
import { loginUser } from '../services/api';

const idToken = await user.getIdToken();
await loginUser(idToken);
```

## Incidents

### Create Incident
```javascript
import { createIncident, updateUserLocation } from '../services/api';

const user = auth.currentUser;

// Update location
await updateUserLocation(
  user.uid,
  location.coords.latitude,
  location.coords.longitude
);

// Create incident
const result = await createIncident(user.uid, {
  incident_type: 'theft',
  description: 'Theft reported',
  latitude: 40.7128,
  longitude: -74.0060,
  severity: 'high'
});

if (result.ok) {
  console.log('Incident created:', result.incidentId);
}
```

### Create Emergency Incident
```javascript
import { createEmergencyIncident } from '../services/api';

const user = auth.currentUser;

const result = await createEmergencyIncident(
  user.uid,
  location.coords.latitude,
  location.coords.longitude,
  'Emergency SOS triggered'
);
```

## Location Updates

### Update User Location with FCM Token
```javascript
import { updateUserLocation } from '../services/api';

await updateUserLocation(
  user.uid,
  latitude,
  longitude,
  fcmToken // optional
);
```

## Fetching Incidents

### Get All Active Incidents
```javascript
import { getIncidents } from '../services/api';

const incidents = await getIncidents();
```

### Get Incidents Near a Location
```javascript
import { getNearbyIncidents } from '../services/api';

const nearby = await getNearbyIncidents(
  latitude,
  longitude,
  radiusKm // 5km default
);
```

### Real-time Incident Updates
```javascript
import { subscribeToIncidents } from '../services/api';

const unsubscribe = subscribeToIncidents(
  latitude,
  longitude,
  radiusKm,
  (incidents) => {
    // This callback is called whenever incidents change
    console.log('Updated incidents:', incidents);
    setIncidents(incidents);
  }
);

// To stop listening
unsubscribe();
```

## Cloud Functions

### Get Hotspots
```javascript
import { httpsCallable, getFunctions } from 'firebase/functions';

const functions = getFunctions();
const getHotspotsFunction = httpsCallable(functions, 'getHotspots');

const result = await getHotspotsFunction({ limit: 50 });
const { hotspots } = result.data;
```

### Get Nearby Incidents (Cloud Function)
```javascript
import { httpsCallable, getFunctions } from 'firebase/functions';

const functions = getFunctions();
const getNearbyFunc = httpsCallable(functions, 'getNearbyIncidents');

const result = await getNearbyFunc({
  latitude: 40.7128,
  longitude: -74.0060,
  radiusKm: 5,
  limit: 100
});

const { incidents, count } = result.data;
```

## Common Patterns

### Authentication Guard
```javascript
import { useAuth } from '../contexts/AuthContext';

export function MyComponent() {
  const { user, loading } = useAuth();

  if (loading) return <ActivityIndicator />;
  if (!user) return <Text>Please log in</Text>;

  return <View>{/* Component content */}</View>;
}
```

### Real-time Location Updates
```javascript
import { useEffect, useState } from 'react';
import { subscribeToIncidents, updateUserLocation } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function MapScreen() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [location, setLocation] = useState(null);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!location) return;

    const unsubscribe = subscribeToIncidents(
      location.latitude,
      location.longitude,
      10, // 10km radius
      setIncidents
    );

    return unsubscribe;
  }, [location]);

  // Update user location
  const handleLocationChange = async (newLat, newLng) => {
    setLocation({ latitude: newLat, longitude: newLng });
    if (user) {
      await updateUserLocation(user.uid, newLat, newLng);
    }
  };

  return <View>{/* Map content */}</View>;
}
```

### Error Handling
```javascript
try {
  const result = await createIncident(user.uid, incidentData);
  
  if (!result.ok) {
    Alert.alert('Error', result.message);
    return;
  }
  
  Alert.alert('Success', 'Incident reported');
} catch (error) {
  console.error('Error:', error);
  Alert.alert('Error', error.message || 'An error occurred');
}
```

## Firestore Data Structure

### User Document
```javascript
// users/{uid}
{
  uid: 'user123',
  email: 'user@example.com',
  displayName: 'John Doe',
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    geoHash: '4069271:740060000',
    lastUpdated: Timestamp
  },
  fcmToken: 'token_xyz',
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Incident Document
```javascript
// incidents/{incidentId}
{
  userId: 'user123',
  incidentType: 'theft',
  description: 'Attempted theft',
  latitude: 40.7128,
  longitude: -74.0060,
  severity: 'high',
  geoHash: '4069271:740060000',
  status: 'active',
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Debugging

### Check Authentication
```javascript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
console.log('Current user:', auth.currentUser);
console.log('UID:', auth.currentUser?.uid);
```

### Check Firestore Connection
```javascript
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const db = getFirestore();
const usersRef = collection(db, 'users');
const snapshot = await getDocs(usersRef);
console.log('Users count:', snapshot.size);
```

### Check Cloud Function Logs
```bash
firebase functions:log
```

## Performance Tips

1. **Use Real-time Listeners Sparingly**
   ```javascript
   // Good: One listener for main content
   const unsubscribe = subscribeToIncidents(...);
   useEffect(() => () => unsubscribe(), []); // Cleanup
   ```

2. **Limit Query Results**
   ```javascript
   // Filter by radius on client for better performance
   const incidents = await getIncidents(lat, lng, 5); // 5km radius
   ```

3. **Cache User Data**
   ```javascript
   // Store user info to avoid repeated fetches
   const [user, setUser] = useState(null);
   useEffect(() => {
     // Fetch once
     if (!user && auth.currentUser) {
       setUser(auth.currentUser);
     }
   }, []);
   ```

## Migration from Old API

### Before (Old Backend)
```javascript
// Old way
const response = await fetch(`${BACKEND_URL}/api/incidents`, {
  method: 'POST',
  headers: authHeaders(token),
  body: JSON.stringify(incidentData)
});
const result = await response.json();
```

### After (Firebase)
```javascript
// New way
import { createIncident } from '../services/api';
const result = await createIncident(user.uid, incidentData);
```

## Support & Resources

- [Firestore SDK Docs](https://firebase.google.com/docs/firestore/query-data/get-data)
- [Cloud Functions Docs](https://firebase.google.com/docs/functions/callable)
- [Firebase Console](https://console.firebase.google.com)
- Check `functions:log` for backend errors
