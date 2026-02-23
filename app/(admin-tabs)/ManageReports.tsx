import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { User, MapPin, AlertCircle, CheckCircle } from "lucide-react-native";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";

type ReportStatus = "pending" | "verified";

type Report = {
  id: string;
  address: string;
  userId: string;
  userName: string;
  status: ReportStatus;
  imageUrl: string;
};

export default function AdminDashboardScreen() {
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Reports">("Dashboard");
  const [reports, setReports] = useState<Report[]>([]);

  const fetchReports = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap: Record<string, string> = {};
      usersSnap.docs.forEach((doc) => {
        const data = doc.data() as any;
        usersMap[doc.id] = data.fullName || "Unknown";
      });

      const reportsSnap = await getDocs(collection(db, "reports"));
      const loaded: Report[] = reportsSnap.docs.map((docSnap) => {
        const d = docSnap.data() as any;
        return {
          id: docSnap.id,
          userId: d.userId,
          userName: usersMap[d.userId] || "Anonymous",
          address: d.location || d.address || "Unknown Location", // ✅ FIXED
          status: d.status || "pending",
          imageUrl: d.imageUrl || "",
        };
      });

      setReports(loaded);
    } catch (err) {
      Alert.alert("Error", "Failed to load reports");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const total = reports.length;
  const pending = reports.filter((r) => r.status === "pending").length;
  const verified = reports.filter((r) => r.status === "verified").length;

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>RoadGuard Admin</Text>
              <Text style={styles.subtitle}>Management Dashboard</Text>
            </View>
            <View style={styles.profile}>
              <User color="white" size={22} />
            </View>
          </View>
        </View>

        {/* TABS */}
        <View style={styles.tabContainer}>
          <TabButton label="Dashboard" active={activeTab === "Dashboard"} onPress={() => setActiveTab("Dashboard")} />
          <TabButton label="Reports" active={activeTab === "Reports"} onPress={() => setActiveTab("Reports")} />
        </View>

        {/* CONTENT */}
        {activeTab === "Dashboard" ? (
          <View style={styles.section}>
            <DashboardCard icon={<MapPin color="#2563EB" size={22} />} label="Total Reports" value={total} />
            <DashboardCard icon={<AlertCircle color="#F59E0B" size={22} />} label="Pending Reports" value={pending} />
            <DashboardCard icon={<CheckCircle color="#16A34A" size={22} />} label="Verified Reports" value={verified} />
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Reports</Text>
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} refresh={fetchReports} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DashboardCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <View style={styles.iconBubble}>{icon}</View>
          <Text style={styles.cardLabel}>{label}</Text>
        </View>
        <Text style={styles.cardValue}>{value}</Text>
      </View>
    </View>
  );
}

function ReportCard({ report, refresh }: { report: Report; refresh: () => void }) {
  const verifyReport = async () => {
    try {
      await updateDoc(doc(db, "reports", report.id), { status: "verified" });
      Alert.alert("Verified", "Report marked as verified");
      refresh();
    } catch (err) {
      Alert.alert("Error", "Could not verify report");
      console.error(err);
    }
  };

  return (
    <View style={styles.reportCard}>
      {report.imageUrl ? (
        <Image source={{ uri: report.imageUrl }} style={styles.reportImage} />
      ) : null}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.address}>{report.address}</Text>
        <Text style={styles.name}>Reported by {report.userName}</Text>
        <Text style={styles.statusText}>Status: {report.status.toUpperCase()}</Text>
      </View>
      {report.status === "pending" && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
          onPress={verifyReport}
        >
          <CheckCircle color="white" size={20} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FB" },
  header: {
    backgroundColor: "#78c6a0",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 30,
    paddingBottom: 30,
    borderRadius: 24,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "white", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "white", marginTop: 4 },
  profile: { backgroundColor: "rgba(255, 255, 255, 0.25)", padding: 12, borderRadius: 999 },
  tabContainer: { flexDirection: "row", margin: 20, backgroundColor: "#E5E7EB", borderRadius: 16, overflow: "hidden" },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#94dcb9" },
  tabText: { fontWeight: "600", color: "#4a4c50" },
  tabTextActive: { color: "ash" },
  section: { paddingHorizontal: 20, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  card: { backgroundColor: "white", padding: 16, borderRadius: 18, marginBottom: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBubble: { backgroundColor: "#d7f5e6", padding: 10, borderRadius: 12 },
  cardLabel: { fontWeight: "600" },
  cardValue: { fontSize: 22, fontWeight: "800" },
  reportCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  reportImage: { width: 80, height: 80, borderRadius: 12 },
  address: { fontWeight: "700" },
  name: { color: "#6b7280", marginTop: 4 },
  statusText: { marginTop: 2, color: "#555", fontSize: 12 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
});