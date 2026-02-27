import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
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

type Props = {
  refreshKey?: number;
};

export default function MapPreview({ refreshKey = 0 }: Props) {
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Refetches whenever refreshKey changes
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
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
              repairedClosed: d.repairedClosed ?? false,
              isCorroboration: d.isCorroboration ?? false,
            };
          })
          .filter((r) => r.coords !== null && !r.repairedClosed && !r.isCorroboration);
        setReports(loaded);
      } catch (err) {
        console.error("Failed to fetch reports for map", err);
      }
      setLoading(false);
    };

    fetchReports();
  }, [refreshKey]);

  const getPinColor = (severity: string) => {
    if (severity === "Severe") return "#e93d3d";
    if (severity === "Medium") return "#f19452";
    return "#FACC15";
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
            anchor={{ x: 0.5, y: 0.5 }}
          >
            {/* Custom small dot pin */}
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
  placeholder: { height: 220, backgroundColor: "#E5E7EB", borderRadius: 16, justifyContent: "center", alignItems: "center" },
  placeholderText: { color: "#6B7280", fontSize: 14 },
  pinOuter: { width: 18, height: 18, borderRadius: 9, backgroundColor: "white", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 4 },
  pinInner: { width: 11, height: 11, borderRadius: 6 },
});
