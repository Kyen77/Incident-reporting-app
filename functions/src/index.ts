import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/firestore";
import { onCall } from "firebase-functions/https";

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// Calculation helpers
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Triggered when a new incident is created
export const onIncidentCreated = onDocumentCreated(
  "incidents/{incidentId}",
  async (event) => {
    const incident = event.data?.data();
    if (!incident) return;

    try {
      // Get the incident reporter's info
      const userDoc = await db.collection("users").doc(incident.userId).get();
      const user = userDoc.data();

      // Find nearby users (within 5km)
      const usersSnapshot = await db.collection("users").get();
      const nearbyUsers = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (!userData.location || !userData.fcmToken || userData.userId === incident.userId) {
          continue;
        }

        const distance = calculateDistance(
          incident.latitude,
          incident.longitude,
          userData.location.latitude,
          userData.location.longitude
        );

        if (distance <= 5) {
          // Within 5km
          nearbyUsers.push({
            uid: userDoc.id,
            fcmToken: userData.fcmToken,
          });
        }
      }

      // Send FCM notifications
      if (nearbyUsers.length > 0) {
        const tokens = nearbyUsers.map((u) => u.fcmToken);
        const severity_emoji: { [key: string]: string } = {
          low: "ℹ️",
          medium: "⚠️",
          high: "🚨",
          critical: "🔴",
        };

        const message = {
          notification: {
            title: `${severity_emoji[incident.severity] || "⚠️"} ${String(incident.incidentType).toUpperCase()} Alert Nearby`,
            body: `${String(incident.description).substring(0, 100)}... - Check your map for details`,
          },
          data: {
            incident_type: String(incident.incidentType),
            severity: String(incident.severity),
            latitude: String(incident.latitude),
            longitude: String(incident.longitude),
          },
        };

        const response = await messaging.sendEachForMulticast({
          tokens,
          notification: message.notification,
          data: message.data,
        });

        console.log(`Sent notifications to ${response.successCount} nearby users`);
      }
    } catch (error) {
      console.error("Error in onIncidentCreated:", error);
    }
  }
);

// Callable function to get nearby incidents
export const getNearbyIncidents = onCall(
  { region: "us-central1" },
  async (request) => {
    const { latitude, longitude, radiusKm = 5, limit = 100 } = request.data;

    if (!latitude || !longitude) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "latitude and longitude required"
      );
    }

    try {
      const snapshot = await db
        .collection("incidents")
        .where("status", "==", "active")
        .orderBy("createdAt", "desc")
        .limit(limit * 2) // Fetch more to account for filtering
        .get();

      const incidents = [];
      for (const doc of snapshot.docs) {
        const incident = doc.data();
        const distance = calculateDistance(
          latitude,
          longitude,
          incident.latitude,
          incident.longitude
        );

        if (distance <= radiusKm) {
          incidents.push({
            id: doc.id,
            ...incident,
            distance,
          });
        }

        if (incidents.length >= limit) break;
      }

      return {
        incidents: incidents.slice(0, limit),
        count: incidents.length,
      };
    } catch (error) {
      console.error("Error in getNearbyIncidents:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to fetch nearby incidents"
      );
    }
  }
);

// Callable function to get hotspots
export const getHotspots = onCall(
  { region: "us-central1" },
  async (request) => {
    const { limit = 50 } = request.data;

    try {
      const snapshot = await db
        .collection("incidents")
        .where("status", "==", "active")
        .get();

      // Group incidents by rounded coordinates
      const hotspots: {
        [key: string]: {
          latitude: number;
          longitude: number;
          count: number;
          incidentTypes: Set<string>;
          incidents: Array<{ id: string; type: string; severity: string }>;
        };
      } = {};

      for (const doc of snapshot.docs) {
        const incident = doc.data();
        const precision = 2; // ~1km grid
        const key = `${Math.round(incident.latitude * Math.pow(10, precision))}:${Math.round(
          incident.longitude * Math.pow(10, precision)
        )}`;

        if (!hotspots[key]) {
          hotspots[key] = {
            latitude: Math.round(incident.latitude * Math.pow(10, precision)) / Math.pow(10, precision),
            longitude: Math.round(incident.longitude * Math.pow(10, precision)) / Math.pow(10, precision),
            count: 0,
            incidentTypes: new Set(),
            incidents: [],
          };
        }

        hotspots[key].count++;
        hotspots[key].incidentTypes.add(incident.incidentType);
        hotspots[key].incidents.push({
          id: doc.id,
          type: incident.incidentType,
          severity: incident.severity,
        });
      }

      // Filter and sort by count
      const result = Object.values(hotspots)
        .filter((h) => h.count >= 3)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((h) => ({
          latitude: h.latitude,
          longitude: h.longitude,
          count: h.count,
          incidentTypes: Array.from(h.incidentTypes),
          incidents: h.incidents,
        }));

      return {
        hotspots: result,
        count: result.length,
      };
    } catch (error) {
      console.error("Error in getHotspots:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to fetch hotspots"
      );
    }
  }
);

// Callable function to update user location
export const updateUserLocation = onCall(
  { region: "us-central1" },
  async (request) => {
    const { latitude, longitude, fcmToken } = request.data;
    const uid = request.auth?.uid;

    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "User not authenticated");
    }

    if (!latitude || !longitude) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "latitude and longitude required"
      );
    }

    try {
      const updateData: {
        location: { latitude: number; longitude: number; geoHash: string; lastUpdated: admin.firestore.FieldValue };
        updatedAt: admin.firestore.FieldValue;
        fcmToken?: string;
      } = {
        location: {
          latitude,
          longitude,
          geoHash: `${Math.round(latitude * 10000)}:${Math.round(longitude * 10000)}`,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (fcmToken) {
        updateData.fcmToken = fcmToken;
      }

      await db.collection("users").doc(uid).set(updateData, { merge: true });

      return {
        success: true,
        message: "Location updated successfully",
      };
    } catch (error) {
      console.error("Error in updateUserLocation:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to update location"
      );
    }
  }
);

export const createIncident = onCall(
  { region: "us-central1" },
  async (request) => {
    const uid = request.auth?.uid || request.data?.userId;
    const {
      incidentType,
      description,
      latitude,
      longitude,
      severity,
    } = request.data ?? {};

    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "User not authenticated");
    }

    if (!incidentType || !description || latitude == null || longitude == null) {
      throw new functions.https.HttpsError("invalid-argument", "Missing incident fields");
    }

    try {
      const incidentRef = await db.collection("incidents").add({
        userId: uid,
        incidentType,
        description,
        latitude,
        longitude,
        severity: severity || "medium",
        geoHash: `${Math.round(latitude * 10000)}:${Math.round(longitude * 10000)}`,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        incidentId: incidentRef.id,
      };
    } catch (error) {
      console.error("Error in createIncident:", error);
      throw new functions.https.HttpsError("internal", "Failed to create incident");
    }
  }
);

export const createEmergencyIncident = onCall(
  { region: "us-central1" },
  async (request) => {
    const uid = request.auth?.uid || request.data?.userId;
    const { latitude, longitude, description } = request.data ?? {};

    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "User not authenticated");
    }

    if (latitude == null || longitude == null) {
      throw new functions.https.HttpsError("invalid-argument", "latitude and longitude required");
    }

    try {
      const incidentRef = await db.collection("incidents").add({
        userId: uid,
        incidentType: "sos",
        description: description || "Emergency SOS triggered",
        latitude,
        longitude,
        severity: "critical",
        geoHash: `${Math.round(latitude * 10000)}:${Math.round(longitude * 10000)}`,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        incidentId: incidentRef.id,
      };
    } catch (error) {
      console.error("Error in createEmergencyIncident:", error);
      throw new functions.https.HttpsError("internal", "Failed to create emergency incident");
    }
  }
);

export const upsertUserProfile = onCall(
  { region: "us-central1" },
  async (request) => {
    const uid = request.auth?.uid;
    const { uid: profileUid, email, displayName } = request.data ?? {};

    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "User not authenticated");
    }

    if (!profileUid || uid !== profileUid) {
      throw new functions.https.HttpsError("permission-denied", "Cannot write another user's profile");
    }

    try {
      await db.collection("users").doc(profileUid).set(
        {
          uid: profileUid,
          email: email ?? null,
          displayName: displayName ?? null,
          fcmToken: null,
          location: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        success: true,
        message: "User profile saved successfully",
      };
    } catch (error) {
      console.error("Error in upsertUserProfile:", error);
      throw new functions.https.HttpsError("internal", "Failed to save user profile");
    }
  }
);

export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", { structuredData: true });
  response.send("Hello from Firebase!");
});
