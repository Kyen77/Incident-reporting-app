# Development Environment Setup

## Installation

### Prerequisites
- Node.js 20+ (install from https://nodejs.org)
- Firebase CLI: `npm install -g firebase-tools`
- Python 3.8+ (for running tests)

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Cloud Functions Setup
```bash
cd functions
npm install
npm run build
firebase emulators:start --only functions
```

### Environment Variables

Create `frontend/.env`:
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Architecture

### Firestore Collections

#### `users/{uid}`
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

#### `incidents/{incidentId}`
```javascript
{
  userId: string,
  incidentType: string,
  description: string,
  latitude: number,
  longitude: number,
  severity: string,
  geoHash: string,
  status: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Cloud Functions

Located in `functions/src/index.ts`:

- **onIncidentCreated**: Firestore trigger when incidents are created
- **getNearbyIncidents**: Callable function for radius search
- **getHotspots**: Callable function for aggregated incident areas  
- **updateUserLocation**: Callable function to update user location

## Testing

### Run Cloud Functions Locally
```bash
cd functions
npm run build
firebase emulators:start --only functions
```

### Test Frontend
```bash
cd frontend
npm start
```

### Run Tests
```bash
cd frontend
npm test
```

## Common Tasks

### Add a New Cloud Function
1. Add function to `functions/src/index.ts`
2. Build: `npm run build`
3. Deploy: `firebase deploy --only functions`

### Create a Firestore Index
1. Visit Firebase Console → Firestore → Indexes
2. Create composite index as needed

### Monitor Logs
```bash
firebase functions:log
```

### View Firestore Data
Firebase Console → Firestore Database → Collections

## Debugging

### Backend Issues
1. Check Cloud Function logs: `firebase functions:log`
2. Check Firestore data is correct
3. Verify security rules in `firestore.rules`

### Frontend Issues
1. Check browser console (inspect element)
2. Add console.log statements
3. Check Firebase auth status

## Performance Tips

1. **Limit queries**: Use radius filtering to reduce results
2. **Index data**: Add Firestore composite indexes for slow queries
3. **Cache data**: Use React state for frequently accessed data
4. **Batch operations**: Combine multiple writes when possible

## Security Best Practices

1. Never commit `.env` or Firebase service account keys
2. Always validate user input on backend
3. Use Firestore security rules to enforce access control
4. Rotate API keys regularly
5. Enable 2FA on Firebase account

## Useful Commands

```bash
# Install dependencies
npm install

# Build Cloud Functions
npm run build

# Watch for changes
npm run watch

# Start emulator
firebase emulators:start

# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only Firestore
firebase deploy --only firestore

# Check logs
firebase functions:log

# Login to Firebase
firebase login

# List projects
firebase projects:list

# Switch project
firebase use project-id
```

## File Structure

```
incident-reporting-app/
├── frontend/              # React Native app
│   ├── app/              # Expo Router screens
│   ├── services/         # Firebase API service
│   ├── contexts/         # React contexts
│   └── assets/           # Images, fonts
├── functions/            # Cloud Functions
│   ├── src/
│   │   └── index.ts      # All functions
│   ├── package.json
│   └── tsconfig.json
├── firebase.json         # Firebase config
├── firestore.rules       # Security rules
└── FIREBASE_MIGRATION.md # This guide
```

## Next Steps

1. Set up Firebase project
2. Deploy Cloud Functions
3. Configure frontend .env
4. Test the application
5. Monitor performance
6. Adjust indexes as needed
