import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { io, Socket } from 'socket.io-client';

interface Incident {
  id: string;
  incident_type: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: string;
  status: string;
  created_at: string;
}

export default function MapScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const mapRef = useRef<MapView>(null);
  const { getIdToken } = useAuth();
  const { location, requestLocation } = useLocation();

  useEffect(() => {
    loadIncidents();
    setupWebSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    // Center map on user location when available
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [location]);

  const setupWebSocket = () => {
    const ws = io(`${process.env.EXPO_PUBLIC_BACKEND_URL}`, {
      path: '/api/ws',
      transports: ['websocket'],
    });

    ws.on('connect', () => {
      console.log('WebSocket connected');
    });

    ws.on('new_incident', (data: any) => {
      console.log('New incident received:', data);
      setIncidents((prev) => [data.data, ...prev]);
      Alert.alert(
        '🚨 New Incident Nearby',
        `${data.data.incident_type.toUpperCase()} reported in your area`,
        [{ text: 'View on Map', onPress: () => focusIncident(data.data) }]
      );
    });

    ws.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    setSocket(ws);
  };

  const focusIncident = (incident: Incident) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: incident.latitude,
        longitude: incident.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setSelectedIncident(incident);
    }
  };

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const token = await getIdToken();

      const url = location
        ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/incidents?latitude=${location.coords.latitude}&longitude=${location.coords.longitude}&radius=10000`
        : `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/incidents`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIncidents(data);
      }
    } catch (error) {
      console.error('Error loading incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadIncidents();
    await requestLocation();
    setRefreshing(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#D32F2F';
      case 'high':
        return '#F57C00';
      case 'medium':
        return '#FBC02D';
      case 'low':
        return '#388E3C';
      default:
        return '#757575';
    }
  };

  const getIncidentIcon = (type: string): any => {
    switch (type) {
      case 'theft':
        return 'bag-remove';
      case 'fire':
        return 'flame';
      case 'medical':
        return 'medical';
      case 'assault':
        return 'warning';
      case 'accident':
        return 'car-crash';
      default:
        return 'alert-circle';
    }
  };

  const initialRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Safety Map</Text>
          <Text style={styles.headerSubtitle}>
            {location
              ? `${incidents.length} incidents nearby`
              : 'Enable location for nearby incidents'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          loadingEnabled={true}
        >
          {incidents.map((incident) => (
            <Marker
              key={incident.id}
              coordinate={{
                latitude: incident.latitude,
                longitude: incident.longitude,
              }}
              pinColor={getSeverityColor(incident.severity)}
              onPress={() => setSelectedIncident(incident)}
              title={incident.incident_type.toUpperCase()}
              description={incident.description}
            >
              <View
                style={[
                  styles.markerContainer,
                  { backgroundColor: getSeverityColor(incident.severity) },
                ]}
              >
                <Ionicons
                  name={getIncidentIcon(incident.incident_type)}
                  size={20}
                  color="#fff"
                />
              </View>
            </Marker>
          ))}
        </MapView>

        {location && (
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={() => {
              if (mapRef.current && location) {
                mapRef.current.animateToRegion({
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                });
              }
            }}
          >
            <Ionicons name="navigate" size={24} color="#4A90E2" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.incidentList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>Recent Incidents</Text>
        {incidents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
            <Text style={styles.emptyStateText}>No incidents reported</Text>
          </View>
        ) : (
          incidents.map((incident) => (
            <TouchableOpacity
              key={incident.id}
              style={[
                styles.incidentCard,
                selectedIncident?.id === incident.id && styles.incidentCardSelected,
              ]}
              onPress={() => focusIncident(incident)}
            >
              <View
                style={[
                  styles.incidentIconContainer,
                  { backgroundColor: getSeverityColor(incident.severity) },
                ]}
              >
                <Ionicons
                  name={getIncidentIcon(incident.incident_type)}
                  size={24}
                  color="#fff"
                />
              </View>
              <View style={styles.incidentContent}>
                <View style={styles.incidentHeader}>
                  <Text style={styles.incidentType}>
                    {incident.incident_type.toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.severityBadge,
                      { backgroundColor: getSeverityColor(incident.severity) },
                    ]}
                  >
                    {incident.severity}
                  </Text>
                </View>
                <Text style={styles.incidentDescription} numberOfLines={2}>
                  {incident.description}
                </Text>
                <View style={styles.incidentFooter}>
                  <Text style={styles.incidentTime}>
                    {new Date(incident.created_at).toLocaleString()}
                  </Text>
                  <TouchableOpacity onPress={() => focusIncident(incident)}>
                    <Text style={styles.viewOnMapText}>View on Map</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  refreshButton: {
    padding: 8,
  },
  mapContainer: {
    height: 300,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  incidentList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  incidentCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  incidentCardSelected: {
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  incidentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  incidentContent: {
    flex: 1,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  incidentType: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    overflow: 'hidden',
  },
  incidentDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  incidentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  incidentTime: {
    fontSize: 12,
    color: '#999',
  },
  viewOnMapText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
});
