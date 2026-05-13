import {
  doc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit as limitQuery,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

const generateGeoHash = (latitude, longitude, precision = 4) => {
  return `${Math.round(latitude * Math.pow(10, precision))}:${Math.round(longitude * Math.pow(10, precision))}`;
};

/**
 * Register user locally.
 *
 * The app no longer depends on a dedicated registration callable, because
 * auth state plus the other incident callables are enough for the current flow.
 */
const registerUser = async ({ firebase_uid, email, display_name }) => {
  try {
    return {
      ok: true,
      message: 'User registration handled by Firebase Auth',
      user: {
        uid: firebase_uid,
        email,
        displayName: display_name,
      },
    };
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

/**
 * Login user (ensure user doc exists in Firestore)
 */
const loginUser = async (idToken) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    return {
      ok: true,
      message: 'Login successful',
      token: idToken,
      user: {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
      },
    };
  } catch (error) {
    console.error('Error logging in user:', error);
    throw error;
  }
};

/**
 * Update user location and FCM token
 */
const updateUserLocation = async (userId, latitude, longitude, fcmToken = null) => {
  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        uid: userId,
        location: {
          latitude,
          longitude,
          geoHash: generateGeoHash(latitude, longitude),
        },
        ...(fcmToken ? { fcmToken } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true, message: 'Location updated successfully' };
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
};

/**
 * Create incident
 */
const createIncident = async (userId, incidentData) => {
  try {
    const docRef = await addDoc(collection(db, 'incidents'), {
      userId,
      incidentType: incidentData.incident_type,
      description: incidentData.description,
      latitude: incidentData.latitude,
      longitude: incidentData.longitude,
      severity: incidentData.severity || 'medium',
      geoHash: generateGeoHash(incidentData.latitude, incidentData.longitude),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      ok: true,
      message: 'Incident reported successfully',
      incidentId: docRef.id,
    };
  } catch (error) {
    console.error('Error creating incident:', error);
    throw error;
  }
};

/**
 * Create emergency incident (SOS)
 * @param {string} userId
 * @param {number} latitude
 * @param {number} longitude
 * @param {string|null} [description=null]
 */
const createEmergencyIncident = async (userId, latitude, longitude, description = null) => {
  try {
    await updateUserLocation(userId, latitude, longitude);
    const docRef = await addDoc(collection(db, 'incidents'), {
      userId,
      incidentType: 'sos',
      description: description || 'Emergency SOS triggered',
      latitude,
      longitude,
      severity: 'critical',
      geoHash: generateGeoHash(latitude, longitude),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { ok: true, message: 'Emergency incident reported successfully', incidentId: docRef.id };
  } catch (error) {
    console.error('Error creating emergency incident:', error);
    throw error;
  }
};

/**
 * Get incidents - optionally filtered by proximity
 * @param {number|null} latitude
 * @param {number|null} longitude
 * @param {number|null} radiusKm
 * @param {string} status
 * @param {number} maxResults
 * @returns {Promise<any[]>}
 */
const getIncidents = async (
  latitude = null,
  longitude = null,
  radiusKm = null,
  status = 'active',
  maxResults = 100
) => {
  try {
    const incidentsQuery = query(
      collection(db, 'incidents'),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limitQuery(maxResults)
    );

    const snapshot = await getDocs(incidentsQuery);
    let incidents = snapshot.docs.map((incidentDoc) => ({
      id: incidentDoc.id,
      ...incidentDoc.data(),
    }));

    if (latitude != null && longitude != null && radiusKm != null) {
      incidents = incidents.filter((incident) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          incident.latitude,
          incident.longitude
        );
        return distance <= radiusKm;
      });
    }

    return incidents;
  } catch (error) {
    console.error('Error fetching incidents:', error);
    throw error;
  }
};

/**
 * Get incidents near a specific location
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [radiusKm=5]
 * @returns {Promise<any[]>}
 */
const getNearbyIncidents = async (latitude, longitude, radiusKm = 5) => {
  return getIncidents(latitude, longitude, radiusKm);
};

/**
 * Subscribe to incidents via polling so the UI stays updated without Firestore listeners
 * @param {number|null} latitude
 * @param {number|null} longitude
 * @param {number|null} radiusKm
 * @param {Function} onSnapshot_callback
 * @param {Function|null} [onError=null]
 */
const subscribeToIncidents = (
  latitude = null,
  longitude = null,
  radiusKm = null,
  onSnapshot_callback,
  onError = null
) => {
  try {
    const incidentsQuery = query(
      collection(db, 'incidents'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      incidentsQuery,
      (snapshot) => {
        let incidents = snapshot.docs.map((incidentDoc) => ({
          id: incidentDoc.id,
          ...incidentDoc.data(),
        }));

        if (latitude != null && longitude != null && radiusKm != null) {
          incidents = incidents.filter((incident) => {
            const distance = calculateDistance(
              latitude,
              longitude,
              incident.latitude,
              incident.longitude
            );
            return distance <= radiusKm;
          });
        }

        onSnapshot_callback(incidents);
      },
      (error) => {
        console.error('Error subscribing to incidents:', error);
        if (onError) {
          onError(error);
        }
      }
    );
  } catch (error) {
    console.error('Error subscribing to incidents:', error);
    throw error;
  }
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (toRad(lat2) - toRad(lat1)) / 2;
  const dLon = (toRad(lon2) - toRad(lon1)) / 2;
  const a = Math.sin(dLat) * Math.sin(dLat) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon) * Math.sin(dLon);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg) => (deg * Math.PI) / 180;

// Deprecated - kept for backward compatibility
const post = async (endpoint, token, data) => {
  console.warn('post() is deprecated, use Firebase methods directly');
};

const get = async (endpoint, token) => {
  console.warn('get() is deprecated, use Firebase methods directly');
};

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

const reportEmergencyIncident = async (token, data) => {
  console.warn('reportEmergencyIncident() is deprecated, use createEmergencyIncident directly');
};

export {
  auth,
  registerUser,
  loginUser,
  updateUserLocation,
  createIncident,
  createEmergencyIncident,
  getIncidents,
  getNearbyIncidents,
  subscribeToIncidents,
  calculateDistance,
  // Deprecated exports for backward compatibility
  post,
  get,
  authHeaders,
  reportEmergencyIncident,
};
