import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

const GOOGLE_API_KEY = "AIzaSyAAhR6d2TrpJZZ4NXq2vWBR_60GjykZYac";

let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (address: string, coords: { lat: number; lng: number }) => void;
}

export default function LocationPickerModal({ visible, onClose, onConfirm }: Props) {
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Auto-fetch when modal opens
  useEffect(() => {
    if (visible) {
      fetchCurrentLocation();
    }
  }, [visible]);

  const fetchCurrentLocation = async () => {
    setLoadingLocation(true);
    setAddress("");
    setMarker(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Location permission denied. Please enable it in settings.");
        setLoadingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setMarker({ lat, lng });

      // Google Geocoding API for precise street-level address
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`
      );
      const data = await response.json();

      if (data.status === "OK" && data.results.length > 0) {
        setAddress(data.results[0].formatted_address);
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (error) {
      alert("Could not fetch location. Please try again.");
    }

    setLoadingLocation(false);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Set Location</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Map — scrollable/zoomable but marker stays fixed to GPS location */}
        {Platform.OS !== "web" && MapView && marker ? (
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: marker.lat,
              longitude: marker.lng,
              latitudeDelta: 0.003,
              longitudeDelta: 0.003,
            }}
            // ✅ scrollEnabled & zoomEnabled = true so user can explore
            // but we do NOT update marker on press — location stays fixed
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={true}
            pitchEnabled={false}
          >
            {Marker && (
              <Marker
                coordinate={{ latitude: marker.lat, longitude: marker.lng }}
                title="Your Location"
                description={address}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            {loadingLocation ? (
              <>
                <ActivityIndicator size="large" color="#4F7DF3" />
                <Text style={styles.placeholderText}>Fetching your location...</Text>
              </>
            ) : (
              <>
                <Ionicons name="map-outline" size={48} color="#C7D2FE" />
                <Text style={styles.placeholderText}>
                  {Platform.OS === "web"
                    ? "Map not available on web."
                    : "Tap below to fetch location."}
                </Text>
              </>
            )}
          </View>
        )}

        {/* Location Info Box */}
        <View style={styles.infoBox}>
          {loadingLocation ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#4F7DF3" />
              <Text style={styles.loadingText}>Detecting your location...</Text>
            </View>
          ) : address ? (
            <View style={styles.addressRow}>
              <Ionicons name="location" size={20} color="#4F7DF3" />
              <Text style={styles.addressText}>{address}</Text>
            </View>
          ) : (
            <Text style={styles.noLocationText}>No location detected yet.</Text>
          )}
        </View>

        {/* Buttons */}
        <View style={styles.actions}>
          {/* Use Current Location — same size and padding as the two buttons below */}
          <TouchableOpacity
            style={styles.currentLocationBtn}
            onPress={fetchCurrentLocation}
            disabled={loadingLocation}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color="#4F7DF3" />
            ) : (
              <Ionicons name="navigate" size={18} color="#4F7DF3" />
            )}
            <Text style={styles.currentLocationText}>
              {loadingLocation ? "Fetching..." : "Use Current Location"}
            </Text>
          </TouchableOpacity>

          {/* Cancel & Confirm */}
          <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!address || loadingLocation) && styles.confirmBtnDisabled,
              ]}
              onPress={() => {
                if (!address || !marker)
                  return alert("Please wait for location to load.");
                onConfirm(address, marker);
                onClose();
              }}
              disabled={!address || loadingLocation}
            >
              <Text style={styles.confirmText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 54,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#457edf" },

  map: { height: 520 },

  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    gap: 12,
  },
  placeholderText: {
    color: "#6B7280",
    fontSize: 15,
    textAlign: "center",
  },

  infoBox: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: { color: "#6B7280", fontSize: 14 },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  addressText: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
  },
  noLocationText: { color: "#9CA3AF", fontSize: 14 },

  actions: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },

  // ✅ Full width, centered, same padding as cancel/confirm
  currentLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -10,   
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#80a3f9",
    backgroundColor: "#EEF2FF",
  },
  currentLocationText: {
    color: "#658ef7",
    fontWeight: "700",
    fontSize: 14,
  },

  bottomRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  cancelText: { color: "#6B7280", fontWeight: "600" },
  confirmBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#4F7DF3",
    alignItems: "center",
  },
  confirmBtnDisabled: { backgroundColor: "#C7D2FE" },
  confirmText: { color: "#fff", fontWeight: "700" },
});