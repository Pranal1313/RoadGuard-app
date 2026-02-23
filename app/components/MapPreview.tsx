import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native"; // ✅ Platform added here
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseConfig";

let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

type PotholeReport = {
  id: string;
  coords: { lat: number; lng: number } | null;
  severity: string;
  location: string;
};

export default function MapPreview() {
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const snapshot = await getDocs(collection(db, "reports"));
        const loaded: PotholeReport[] = snapshot.docs
          .map((docSnap) => {
            const d = docSnap.data() as any;
            return {
              id: docSnap.id,
              coords: d.coords || null,
              severity: d.severity || "Medium",
              location: d.location || d.address || "",
            };
          })
          .filter((r) => r.coords !== null); // only show reports with GPS coords
        setReports(loaded);
      } catch (err) {
        console.error("Failed to fetch reports for map", err);
      }
      setLoading(false);
    };

    fetchReports();
  }, []);

  // Color based on severity
  const getPinColor = (severity: string) => {
    if (severity === "Severe") return "#EF4444";   // red
    if (severity === "Medium") return "#F97316";   // orange
    return "#FACC15";                              // yellow
  };

  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="small" color="#4F7DF3" />
      </View>
    );
  }

  if (Platform.OS === "web" || !MapView) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Map not available on web</Text>
      </View>
    );
  }

  // Center map on first report or default to Sri Lanka
  const center =
    reports.length > 0
      ? { latitude: reports[0].coords!.lat, longitude: reports[0].coords!.lng }
      : { latitude: 7.8731, longitude: 80.7718 };

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      initialRegion={{
        ...center,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      scrollEnabled={true}
      zoomEnabled={true}
    >
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
            pinColor={getPinColor(report.severity)}
          />
        ) : null
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
  },
  placeholder: {
    height: 220,
    backgroundColor: "#E5E7EB",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#6B7280",
    fontSize: 14,
  },
});