import React, { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { BACKEND_URL, reportEmergencyIncident } from '../../services/api';

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
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const { getIdToken } = useAuth();

  // To avoid unused variable warning, define a function to select an incident
  const handleSelectIncident = (incident: Incident) => {
    setSelectedIncident(incident);
    openInMaps(incident.latitude, incident.longitude);
  };
  const { location, requestLocation } = useLocation();

  useEffect(() => {
    const fetchIncidents = async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        const token = await getIdToken();

        const url = location
          ? `${BACKEND_URL}/api/incidents?latitude=${location.coords.latitude}&longitude=${location.coords.longitude}&radius=10000`
          : `${BACKEND_URL}/api/incidents`;

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
        if (showLoading) setLoading(false);
      }
    };

    fetchIncidents();
  }, [location, getIdToken]);

  useEffect(() => {
    const wsBaseUrl = BACKEND_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBaseUrl}/api/ws`);

    ws.onopen = () => {
      ws.send('client_connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'new_incident' && payload?.data) {
          setIncidents((prev) => [payload.data, ...prev]);
          Alert.alert(
            '🚨 New Incident Nearby',
            `${payload.data.incident_type.toUpperCase()} reported in your area`,
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.warn('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (event) => {
      console.warn('WebSocket error:', event);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => ws.close();
  }, []); // Only setup websocket once

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const token = await getIdToken();
      const url = location
        ? `${BACKEND_URL}/api/incidents?latitude=${location.coords.latitude}&longitude=${location.coords.longitude}&radius=10000`
        : `${BACKEND_URL}/api/incidents`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setIncidents(data);
      }
    } catch (error) {
      console.error('Error loading incidents:', error);
    }
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
      case 'sos':
        return 'alert-circle';
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

  const openInMaps = async (lat: number, lng: number) => {
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Error', 'Unable to open maps on this device');
      return;
    }

    await Linking.openURL(url);
  };

  const sendEmergencyIncident = async () => {
    if (sosSubmitting) return;

    if (!location) {
      Alert.alert('Location required', 'Enable location to send an SOS alert.');
      await requestLocation();
      return;
    }

    const token = await getIdToken();
    if (!token) {
      Alert.alert('Error', 'You must be signed in to send an SOS alert.');
      return;
    }

    try {
      setSosSubmitting(true);
      const response = await reportEmergencyIncident(token, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        description: 'Emergency SOS triggered',
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          'SOS Sent',
          `Emergency alert sent. ${data.nearby_users_notified} nearby users notified.`,
          [{ text: 'OK' }]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to send SOS alert');
      }
    } catch (error) {
      console.error('Error sending SOS alert:', error);
      Alert.alert('Error', 'Failed to send SOS alert. Please try again.');
    } finally {
      setSosSubmitting(false);
    }
  };

  const handleSOSPress = () => {
    if (sosSubmitting) return;
    Alert.alert(
      'Send SOS?',
      'This will send a critical alert with your location to nearby users.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send SOS', style: 'destructive', onPress: sendEmergencyIncident },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  const centerLat = location?.coords.latitude || 37.7749;
  const centerLng = location?.coords.longitude || -122.4194;

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
        <View style={styles.webMapWrapper}>
          <Text style={styles.mapTitle}>📍 Live Incident Map</Text>
          <View style={styles.mapIframe}>
            {/* Google Maps Embed */}
            <View style={{ flex: 1, backgroundColor: '#e5e7eb' }}>
              <Text style={styles.mapLoadingText}>Loading Map...</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.mapOverlay}>
          {incidents.slice(0, 10).map((incident, index) => (
            <View
              key={incident.id}
              style={[
                styles.miniMarker,
                { backgroundColor: getSeverityColor(incident.severity) },
                { 
                  left: `${Math.random() * 80 + 10}%`, 
                  top: `${Math.random() * 60 + 20}%` 
                },
              ]}
            >
              <Ionicons
                name={getIncidentIcon(incident.incident_type)}
                size={12}
                color="#fff"
              />
            </View>
          ))}
        </View>

        {location && (
          <TouchableOpacity
            style={styles.openMapsButton}
            onPress={() => openInMaps(centerLat, centerLng)}
          >
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.openMapsText}>Open in Maps</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sosContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.sosButton, sosSubmitting && styles.sosButtonDisabled]}
          onPress={handleSOSPress}
          disabled={sosSubmitting}
        >
          {sosSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="radio-button-on" size={22} color="#fff" />
              <Text style={styles.sosButtonText}>SOS</Text>
            </>
          )}
        </TouchableOpacity>
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
              onPress={() => handleSelectIncident(incident)}
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
                  <View style={styles.locationLink}>
                    <Ionicons name="location" size={14} color="#4A90E2" />
                    <Text style={styles.viewOnMapText}>View on Map</Text>
                  </View>
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
  webMapWrapper: {
    flex: 1,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mapIframe: {
    flex: 1,
  },
  mapLoadingText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingTop: 80,
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  miniMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  openMapsButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  openMapsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  locationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewOnMapText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '600',
  },
  sosContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center',
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D32F2F',
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  sosButtonDisabled: {
    opacity: 0.6,
  },
  sosButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
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
