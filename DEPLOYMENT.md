# Deployment Instructions

## Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project created at [console.firebase.google.com](https://console.firebase.google.com)
- Firebase project ID ready

## Step 1: Configure Firebase Project ID

Update `firebase.json`:
```json
{
  "projects": {
    "default": "YOUR_ACTUAL_PROJECT_ID"
  }
}
```

## Step 2: Authenticate with Firebase

```bash
firebase login
firebase projects:list  # Verify your project
```

## Step 3: Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions:onIncidentCreated,functions:getNearbyIncidents,functions:getHotspots,functions:updateUserLocation
```

Wait for all functions to deploy successfully.

## Step 4: Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

## Step 5: Configure Frontend

Create or update `frontend/.env`:
```
EXPO_PUBLIC_FIREBASE_API_KEY=<from Firebase Console>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from Firebase Console>
EXPO_PUBLIC_FIREBASE_APP_ID=<from Firebase Console>
```

## Step 6: Test the Application

```bash
cd frontend
npm install
npm start
```

Test:
1. Create a user account
2. Report an incident
3. Check alerts screen for nearby incidents
4. Test emergency SOS feature
5. Check profile page for hotspots

## Step 7: Monitor Deployment

### Check Cloud Function Logs
```bash
firebase functions:log
```

### Check Firestore in Console
Visit [Firebase Console](https://console.firebase.google.com) → Your Project → Firestore Database

Verify:
- Users are being created
- Incidents are being recorded
- Real-time updates are working

## Troubleshooting

### Cloud Functions Not Deploying
```bash
firebase deploy --only functions --debug
```

### Firestore Rules Error
- Check syntax in `firestore.rules`
- Common issues: missing semicolons, incorrect paths

### Incidents Not Appearing in App
- Check Firestore data in console
- Verify security rules allow read access
- Check browser console for errors

### FCM Notifications Not Working
- Ensure users have FCM tokens set
- Check Cloud Function logs for errors
- Verify Firebase Messaging is enabled

## Rollback (if needed)

To restore previous deployment:
```bash
firebase functions:delete onIncidentCreated getNearbyIncidents getHotspots updateUserLocation
```

## Performance Optimization

### 1. Create Firestore Indexes
If you see slow queries, navigate to Firestore → Indexes and create composite indexes as suggested by Firebase.

### 2. Monitor Usage
Check Firebase Console → Usage for:
- Firestore reads/writes
- Cloud Function invocations
- Costs

### 3. Optimize Queries
Current optimizations:
- Client-side distance calculations
- GeoHash for geographic queries
- Index on `status` field

## Cost Monitoring

Expected costs for small deployment:
- **Free tier**: Up to 25k reads/writes per day (first month)
- **Production**: ~$10-50/month for small to medium usage

View billing:
Firebase Console → Blaze Plan Settings → Billing

## Enabling Additional Services

### Cloud Storage (for incident photos - optional)
```bash
firebase deploy --only storage
```

### Firestore Backups (optional)
Enable in Firebase Console → Firestore → Backups

### Cloud Logging (monitoring)
Automatically enabled - view in Firebase Console → Logs

## CI/CD Integration

To deploy via GitHub Actions, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
```

## Next Steps

1. ✅ Deploy Cloud Functions
2. ✅ Deploy Firestore Rules
3. ✅ Configure Frontend
4. ✅ Test Application
5. ✅ Monitor Logs
6. ✅ Optimize Performance
7. Set up monitoring alerts
8. Configure backups
9. Plan for scaling

## Support

For Firebase-specific issues:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
