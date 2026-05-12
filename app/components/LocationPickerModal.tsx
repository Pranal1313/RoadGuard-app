
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

// Google Maps API key used for reverse geocoding (address lookup from lat/lng)
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
  // Called when the user taps "Confirm Location" — passes address string + coords
  onConfirm: (address: string, coords: { lat: number; lng: number }) => void;
}

export default function LocationPickerModal({ visible, onClose, onConfirm }: Props) {
  // Lat/lng of the detected GPS position
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);

  // Human-readable address from reverse geocoding
  const [address, setAddress] = useState("");

  // True while the GPS position is being fetched
  const [loadingLocation, setLoadingLocation] = useState(false);

  // True while the geocoding API call is in progress
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Auto-fetch GPS location every time the modal opens
  useEffect(() => {
    if (visible) {
      fetchCurrentLocation();
    }
  }, [visible]);

  // ── GPS detection ─────────────────────────────────────────────────────────
  const fetchCurrentLocation = async () => {
    setLoadingLocation(true);
    setAddress("");   // clear stale address
    setMarker(null);  // clear stale pin

    try {
      // Request foreground location permission if not already granted
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Location permission denied. Please enable it in settings.");
        setLoadingLocation(false);
        return;
      }

      // Get the most accurate position available
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      setMarker({ lat, lng }); // place the map pin

      // Immediately look up a human-readable address for these coordinates
      await reverseGeocode(lat, lng);
    } catch (error) {
      alert("Could not fetch location. Please try again.");
    }

    setLoadingLocation(false);
  };

  // ── Reverse geocoding via Google Maps API ─────────────────────────────────
  // Converts lat/lng → a formatted street address string
  const reverseGeocode = async (lat: number, lng: number) => {
    setLoadingAddress(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`
      );
      const data = await response.json();

      if (data.status === "OK" && data.results.length > 0) {
        // Use the first (most specific) result's formatted address
        setAddress(data.results[0].formatted_address);
      } else {
        // Fallback to raw coordinates if geocoding fails
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      // Network error fallback
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
    setLoadingAddress(false);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>

        {/* ── Modal header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Location</Text>
          {/* Close without confirming */}
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* ── Map (native only; shows a read-only view of the GPS position) ── */}
        {Platform.OS !== "web" && MapView && marker ? (
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={{
              latitude: marker.lat,
              longitude: marker.lng,
              latitudeDelta: 0.003,  // tight zoom to show street-level detail
              longitudeDelta: 0.003,
            }}
            // Map is display-only — scroll/zoom disabled to prevent accidental movement
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={false}
            pitchEnabled={false}

onPress={(e: any) => {
  const { latitude, longitude } = e.nativeEvent.coordinate;

  setMarker({ lat: latitude, lng: longitude });
  reverseGeocode(latitude, longitude);
}}
          >
            {/* Single marker pinned at the detected GPS location */}
            {Marker && (
              <Marker
                coordinate={{ latitude: marker.lat, longitude: marker.lng }}
                title="Your Location"
                description={address}
              />
            )}
          </MapView>
        ) : (
          // Placeholder shown while loading or on web (no map support)
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
                    : "Tap below to fetch your location."}
                </Text>
              </>
            )}
          </View>
        )}

        {/* ── "Using live GPS" badge shown once location is detected ── */}
        {marker && !loadingLocation && (
          <View style={styles.liveBadge}>
            <Ionicons name="navigate" size={14} color="#059669" />
            <Text style={styles.liveBadgeText}>Using your live GPS location</Text>
          </View>
        )}

        {/* ── Address info box (shows loading states or the resolved address) ── */}
        <View style={styles.infoBox}>
          {loadingLocation ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#4F7DF3" />
              <Text style={styles.loadingText}>Detecting your location...</Text>
            </View>
          ) : loadingAddress ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#4F7DF3" />
              <Text style={styles.loadingText}>Getting address...</Text>
            </View>
          ) : address ? (
            // Display the resolved address with a pin icon
            <View style={styles.addressRow}>
              <Ionicons name="location" size={20} color="#4F7DF3" />
              <Text style={styles.addressText}>{address}</Text>
            </View>
          ) : (
            <Text style={styles.noLocationText}>No location detected yet.</Text>
          )}
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actions}>
          {/* Re-detect GPS location (useful if user moved or location was wrong) */}
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
              {loadingLocation ? "Fetching..." : "Refresh My Location"}
            </Text>
          </TouchableOpacity>

          {/* Cancel + Confirm row */}
          <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            {/* Confirm is disabled until we have a valid address and coordinates */}
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!address || loadingLocation || loadingAddress) && styles.confirmBtnDisabled,
              ]}
              onPress={() => {
                if (!address || !marker)
                  return alert("Please wait for location to load.");
                onConfirm(address, marker); // pass data back to ReportScreen
                onClose();
              }}
              disabled={!address || loadingLocation || loadingAddress}
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
    paddingTop: 54, // clear the iOS notch / status bar
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#457edf" },
  map: { height: 420 },
  mapPlaceholder: {
    height: 420,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    gap: 12,
  },
  placeholderText: { color: "#6B7280", fontSize: 15, textAlign: "center" },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#ECFDF5",      // light green
    borderBottomWidth: 1,
    borderColor: "#A7F3D0",
  },
  liveBadgeText: { color: "#059669", fontSize: 12, fontWeight: "600" },
  infoBox: { padding: 16, borderTopWidth: 1, borderColor: "#E5E7EB" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: "#6B7280", fontSize: 14 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  addressText: { flex: 1, color: "#111827", fontSize: 15, fontWeight: "500", lineHeight: 22 },
  noLocationText: { color: "#9CA3AF", fontSize: 14 },
  actions: { padding: 16, gap: 12, paddingBottom: 32 },
  currentLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#80a3f9",
    backgroundColor: "#EEF2FF",
  },
  currentLocationText: { color: "#658ef7", fontWeight: "700", fontSize: 14 },
  bottomRow: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  cancelText: { color: "#6B7280", fontWeight: "600" },
  confirmBtn: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: "#4F7DF3", alignItems: "center" },
  confirmBtnDisabled: { backgroundColor: "#C7D2FE" }, // greyed out when not ready
  confirmText: { color: "#fff", fontWeight: "700" },
});
