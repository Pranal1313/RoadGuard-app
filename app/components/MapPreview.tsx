// A compact map widget (220px tall) embedded in HomeScreen.
// Fetches all active (non-closed, non-corroboration) pothole reports
// from Firestore and plots colour-coded pins on a Google Map.
// Re-fetches whenever the `refreshKey` prop changes.


import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseConfig";

// ── Conditionally import react-native-maps (crashes on web) ──────────────────
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

// Shape of a single report as used by this component
type PotholeReport = {
  id: string;
  coords: { lat: number; lng: number } | null; // null if location wasn't set
  severity: string;      // "Medium" | "Severe" | fallback
  location: string;      // human-readable address (used as marker description)
  createdAt: number;     // Unix ms timestamp for sorting
};

// Props: refreshKey increments from the parent to trigger a re-fetch
type Props = {
  refreshKey?: number;
};

export default function MapPreview({ refreshKey = 0 }: Props) {
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Re-fetch whenever refreshKey changes (parent signals new data available)
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        // Get ALL reports — filtering happens in JS below
        const snapshot = await getDocs(collection(db, "reports"));

        const loaded: PotholeReport[] = snapshot.docs
          .map((docSnap) => {
            const d = docSnap.data() as any;
            return {
              id: docSnap.id,
              coords: d.coords || null,
              severity: d.severity || "Medium",
              location: d.location || d.address || "",
              repairedClosed: d.repairedClosed ?? false,     // officially closed by admin
              isCorroboration: d.isCorroboration ?? false,   // secondary/duplicate doc
              createdAt: d.createdAt?.toMillis?.() ?? 0,     // Firestore Timestamp → ms
            };
          })
          // Only show reports that:
          //  • have GPS coordinates (coords !== null)
          //  • have NOT been officially repaired/closed
          //  • are the master report (not a corroboration sub-document)
          .filter((r) => r.coords !== null && !r.repairedClosed && !r.isCorroboration);

        // Sort oldest → newest so index 0 = the oldest active report
        // (used to centre the map on the earliest unresolved pothole)
        loaded.sort((a, b) => a.createdAt - b.createdAt);

        setReports(loaded);
      } catch (err) {
        console.error("Failed to fetch reports for map", err);
      }
      setLoading(false);
    };

    fetchReports();
  }, [refreshKey]); // dependency on refreshKey forces re-fetch when parent triggers it

  // ── Pin colour based on severity ─────────────────────────────────────────
  const getPinColor = (severity: string) => {
    if (severity === "Severe") return "#e93d3d"; // red for severe
    if (severity === "Medium") return "#f19452"; // orange for medium
    return "#FACC15";                            // yellow fallback
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="small" color="#4F7DF3" />
      </View>
    );
  }

  // ── Web / no-map fallback ─────────────────────────────────────────────────
  if (Platform.OS === "web" || !MapView) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Map not available on web</Text>
      </View>
    );
  }

  // Centre map on the oldest active report, or default to the centre of Sri Lanka
  const center =
    reports.length > 0
      ? { latitude: reports[0].coords!.lat, longitude: reports[0].coords!.lng }
      : { latitude: 7.8731, longitude: 80.7718 }; // Sri Lanka geographic centre

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      initialRegion={{
        ...center,
        latitudeDelta: 0.05,   // roughly city-level zoom
        longitudeDelta: 0.05,
      }}
      scrollEnabled={true}   // user can pan the map
      zoomEnabled={true}     // user can pinch-to-zoom
    >
      {/* Render a custom dot-style marker for each active report */}
      {reports.map((report) =>
        report.coords ? (
          <Marker
            key={report.id}
            coordinate={{
              latitude: report.coords.lat,
              longitude: report.coords.lng,
            }}
            title={report.severity + " Pothole"}
            description={report.location}
            anchor={{ x: 0.5, y: 0.5 }} // centre the custom view on the coordinate
          >
            {/* Custom dot pin: white outer circle + coloured inner dot */}
            <View style={styles.pinOuter}>
              <View style={[styles.pinInner, { backgroundColor: getPinColor(report.severity) }]} />
            </View>
          </Marker>
        ) : null
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { height: 220, borderRadius: 16, overflow: "hidden" },
  // Shown while loading or on web
  placeholder: {
    height: 220,
    backgroundColor: "#E5E7EB",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { color: "#6B7280", fontSize: 14 },
  // Outer white ring of the custom pin
  pinOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  // Inner coloured dot (severity colour applied dynamically)
  pinInner: { width: 11, height: 11, borderRadius: 6 },
});
