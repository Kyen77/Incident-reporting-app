import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useLocation } from "../../contexts/LocationContext";

const INCIDENT_TYPES = [
  {
    id: "armed robbery",
    label: "Armed Robbery",
    icon: "alert-circle",
    color: "#11070713",
  },
  { id: "banditry", label: "Banditry", icon: "mask", color: "#11070713" },
  { id: "theft", label: "Theft", icon: "bag-remove", color: "#F57C00" },
  { id: "fire", label: "Fire", icon: "flame", color: "#D32F2F" },
  {
    id: "medical",
    label: "Medical Emergency",
    icon: "medical",
    color: "#C62828",
  },
  { id: "assault", label: "Assault", icon: "warning", color: "#E65100" },
  { id: "accident", label: "Accident", icon: "car-crash", color: "#F57C00" },
  { id: "other", label: "Other", icon: "alert-circle", color: "#757575" },
];

const SEVERITY_LEVELS = [
  { id: "low", label: "Low", color: "#388E3C" },
  { id: "medium", label: "Medium", color: "#FBC02D" },
  { id: "high", label: "High", color: "#F57C00" },
  { id: "critical", label: "Critical", color: "#D32F2F" },
];

export default function ReportScreen() {
  const [selectedType, setSelectedType] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [loading, setLoading] = useState(false);
  const { getIdToken } = useAuth();
  const { location, requestLocation, loading: locationLoading } = useLocation();

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert("Error", "Please select an incident type");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Error", "Please provide a description");
      return;
    }

    if (!location) {
      Alert.alert(
        "Error",
        "Location is required. Please enable location services.",
      );
      await requestLocation();
      return;
    }

    try {
      setLoading(true);
      const token = await getIdToken();

      // Update user location first
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/user/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
      });

      // Report incident
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/incidents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            incident_type: selectedType,
            description: description.trim(),
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            severity,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          "Success",
          `Incident reported successfully! ${data.nearby_users_notified} nearby users notified.`,
          [
            {
              text: "OK",
              onPress: () => {
                setSelectedType("");
                setDescription("");
                setSeverity("medium");
              },
            },
          ],
        );
      } else {
        const error = await response.json();
        Alert.alert("Error", error.detail || "Failed to report incident");
      }
    } catch (error: any) {
      console.error("Error reporting incident:", error);
      Alert.alert("Error", "Failed to report incident. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={32} color="#4A90E2" />
        <Text style={styles.headerTitle}>Report Incident</Text>
        <Text style={styles.headerSubtitle}>Help keep your community safe</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incident Type *</Text>
          <View style={styles.typeGrid}>
            {INCIDENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && {
                    borderColor: type.color,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setSelectedType(type.id)}
                disabled={loading}
              >
                <View
                  style={[
                    styles.typeIcon,
                    selectedType === type.id && { backgroundColor: type.color },
                  ]}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={28}
                    color={selectedType === type.id ? "#fff" : type.color}
                  />
                </View>
                <Text
                  style={[
                    styles.typeLabel,
                    selectedType === type.id && {
                      color: type.color,
                      fontWeight: "600",
                    },
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Severity Level</Text>
          <View style={styles.severityContainer}>
            {SEVERITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.severityButton,
                  severity === level.id && {
                    backgroundColor: level.color,
                  },
                ]}
                onPress={() => setSeverity(level.id)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.severityText,
                    severity === level.id && styles.severityTextActive,
                  ]}
                >
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the incident in detail..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            editable={!loading}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationCard}>
            {locationLoading ? (
              <ActivityIndicator size="small" color="#4A90E2" />
            ) : location ? (
              <>
                <Ionicons name="location" size={24} color="#4CAF50" />
                <View style={styles.locationInfo}>
                  <Text style={styles.locationText}>Location Detected</Text>
                  <Text style={styles.locationCoords}>
                    {location.coords.latitude.toFixed(6)},{" "}
                    {location.coords.longitude.toFixed(6)}
                  </Text>
                </View>
                <TouchableOpacity onPress={requestLocation}>
                  <Ionicons name="refresh" size={20} color="#4A90E2" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="location-outline" size={24} color="#F57C00" />
                <Text style={styles.locationError}>Location not available</Text>
                <TouchableOpacity onPress={requestLocation}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    padding: 24,
    paddingTop: 60,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  typeCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  severityContainer: {
    flexDirection: "row",
    gap: 8,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  severityText: {
    fontSize: 14,
    color: "#666",
  },
  severityTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  textArea: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#333",
    borderWidth: 1,
    borderColor: "#ddd",
    minHeight: 120,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    gap: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  locationCoords: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  locationError: {
    flex: 1,
    fontSize: 14,
    color: "#F57C00",
  },
  retryText: {
    fontSize: 14,
    color: "#4A90E2",
    fontWeight: "600",
  },
  footer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  submitButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 12,
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#A0C4E8",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
