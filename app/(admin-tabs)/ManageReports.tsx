import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Platform,
  TouchableOpacity, Image, Alert, Modal, Dimensions,
} from "react-native";
import { User, MapPin, AlertCircle, CheckCircle, Flame, XCircle, X } from "lucide-react-native";
import {
  collection, getDocs, doc, updateDoc, query, orderBy, getDoc, setDoc, where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ReportStatus = "pending" | "verified" | "rejected";
type ReportFilter = "multiuser" | "repair" | "all" | "pending" | "verified" | "rejected";

type Report = {
  id: string;
  address: string;
  description: string;
  userId: string;
  userName: string;
  status: ReportStatus;
  imageUrl: string;
  creditEligible: boolean;
  creditsAwarded: boolean;
  corroborationCount: number;
  corroboratedBy: string[];
  corroboratorNames: string[];
  corroboratorImages: string[];
  isCorroboration: boolean;
  repairVerificationPending: boolean;
  repairedClosed: boolean;
  repairVerifiedAt?: string;
  fixedVotes: string[];
};

function ImageViewerModal({ visible, imageUrl, onClose }: {
  visible: boolean; imageUrl: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={26} color="white" />
        </TouchableOpacity>
        <Image source={{ uri: imageUrl }} style={styles.fullImage} resizeMode="contain" />
      </View>
    </Modal>
  );
}

export default function AdminDashboardScreen() {
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Reports">("Dashboard");
  const [activeFilter, setActiveFilter] = useState<ReportFilter>("multiuser");
  const [reports, setReports] = useState<Report[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchReports = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap: Record<string, string> = {};
      usersSnap.docs.forEach((d) => {
        const data = d.data() as any;
        usersMap[d.id] = data.fullName || "Unknown";
      });

      const reportsSnap = await getDocs(
        query(collection(db, "reports"), orderBy("createdAt", "asc"))
      );

      const loaded: Report[] = reportsSnap.docs
        .map((docSnap) => {
          const d = docSnap.data() as any;
          const corroboratedBy: string[] = d.corroboratedBy && d.corroboratedBy.length > 0
            ? d.corroboratedBy : [d.userId];
          const corroboratorNames = corroboratedBy.map(
            (uid: string) => usersMap[uid] || "Unknown User"
          );
          return {
            id: docSnap.id,
            userId: d.userId,
            userName: usersMap[d.userId] || "Anonymous",
            address: d.location || d.address || "Unknown Location",
            description: d.description || "",
            status: d.status || "pending",
            imageUrl: d.imageUrl || "",
            creditEligible: d.creditEligible ?? true,
            creditsAwarded: d.creditsAwarded ?? false,
            corroborationCount: d.corroborationCount ?? 1,
            corroboratedBy,
            corroboratorNames,
            corroboratorImages: d.corroboratorImages ?? [],
            isCorroboration: d.isCorroboration ?? false,
            repairVerificationPending: d.repairVerificationPending ?? false,
            repairedClosed: d.repairedClosed ?? false,
            repairVerifiedAt: d.repairVerifiedAt,
            fixedVotes: d.fixedVotes ?? [],
          };
        })
        .filter((r) => !r.isCorroboration);

      setReports(loaded);
    } catch (err) {
      Alert.alert("Error", "Failed to load reports");
      console.error(err);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const dismissCard = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const activeReports = reports.filter((r) => !r.repairedClosed);
  const total    = reports.length;
  const pending  = activeReports.filter((r) => r.status === "pending").length;
  const verified = activeReports.filter((r) => r.status === "verified").length;
  const rejected = activeReports.filter((r) => r.status === "rejected").length;
  const multi    = activeReports.filter((r) => r.corroborationCount >= 2).length;
  const repairPending = activeReports.filter(
    (r) => (r.repairVerificationPending || r.fixedVotes.length >= 1) && !r.repairedClosed
  ).length;

  const goToReports = (filter: ReportFilter) => {
    setActiveFilter(filter);
    setActiveTab("Reports");
  };

  const filteredReports = reports.filter((r) => {
    if (activeFilter === "all")       return !dismissedIds.has(r.id);
    if (activeFilter === "multiuser") return r.corroborationCount >= 2 && !r.repairedClosed;
    if (activeFilter === "repair")
      return (r.repairVerificationPending || r.fixedVotes.length >= 1) && !r.repairedClosed;
    if (activeFilter === "pending")   return r.status === "pending" && !r.repairedClosed;
    if (activeFilter === "verified")  return r.status === "verified" && !r.repairedClosed;
    if (activeFilter === "rejected")  return r.status === "rejected";
    return true;
  });

  const filterLabel: Record<ReportFilter, string> = {
    multiuser: "Multi-User Reports 👥",
    repair:    "Repair Requests 🔧",
    all:       "All Reports",
    pending:   "Pending Reports",
    verified:  "Verified Reports",
    rejected:  "Rejected Reports",
  };

  const filterOrder: ReportFilter[] = ["multiuser", "repair", "all", "pending", "verified", "rejected"];

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>RoadGuard Admin</Text>
              <Text style={styles.subtitle}>Executive Management Panel</Text>
            </View>
            <View style={styles.profile}>
              <User color="white" size={22} />
            </View>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TabButton label="Dashboard" active={activeTab === "Dashboard"} onPress={() => setActiveTab("Dashboard")} />
          <TabButton label="Reports"   active={activeTab === "Reports"}   onPress={() => setActiveTab("Reports")} />
        </View>

        {activeTab === "Dashboard" ? (
          <View style={styles.section}>
            {repairPending > 0 && (
              <DashboardCard
                icon={<CheckCircle color="#92400E" size={13} />}
                label="Repair Requests 🔧"
                value={repairPending}
                color="#FEF3C7"
                onPress={() => goToReports("repair")}
              />
            )}
            <DashboardCard icon={<Flame color="#C2410C" size={13} />}       label="Multi-User Reports  👥" value={multi}    color="#e7f7ec" onPress={() => goToReports("multiuser")} />
            <DashboardCard icon={<MapPin color="#065F46" size={13} />}      label="Total Reports"          value={total}    color="#e7f7ec" onPress={() => goToReports("all")} />
            <DashboardCard icon={<AlertCircle color="#065F46" size={13} />} label="Pending Reports"        value={pending}  color="#e7f7ec" onPress={() => goToReports("pending")} />
            <DashboardCard icon={<CheckCircle color="#065F46" size={13} />} label="Verified Reports"       value={verified} color="#e7f7ec" onPress={() => goToReports("verified")} />
            <DashboardCard icon={<XCircle color="#991B1B" size={13} />}     label="Rejected Reports"       value={rejected} color="#FEE2E2" onPress={() => goToReports("rejected")} />
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{filterLabel[activeFilter]}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {filterOrder.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                  onPress={() => setActiveFilter(f)}
                >
                  <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
                    {f === "multiuser" ? "👥 Multi-User"
                      : f === "repair" ? "🔧 Repair"
                      : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredReports.length === 0 ? (
              <Text style={styles.emptyText}>No {filterLabel[activeFilter].toLowerCase()} found.</Text>
            ) : (
              filteredReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  refresh={fetchReports}
                  isRepairTab={activeFilter === "repair"}
                  onDismiss={dismissCard}
                />
              ))
            )}
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

function DashboardCard({ icon, label, value, color, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <View style={styles.iconBubble}>{icon}</View>
          <Text style={styles.cardLabel}>{label}</Text>
        </View>
        <Text style={styles.cardValue}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ReportCard({ report, refresh, isRepairTab, onDismiss }: {
  report: Report;
  refresh: () => void;
  isRepairTab: boolean;
  onDismiss: (id: string) => void;
}) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState("");

  const openImage = (url: string) => { setViewerImage(url); setViewerVisible(true); };

  const fixedVoteCount = report.fixedVotes.length;
  const allConfirmed   = fixedVoteCount >= 3;
  const showRepairAction =
    (report.repairVerificationPending || fixedVoteCount >= 1) && !report.repairedClosed;

  const isHighPriority = report.corroborationCount >= 2;
  const isPending      = report.status === "pending";
  const isRejected     = report.status === "rejected";
  const isClosed       = report.repairedClosed;
  const allNames       = report.corroboratorNames.length > 0 ? report.corroboratorNames : [report.userName];

  const verifyReport = async () => {
    Alert.alert("Verify Report", `Award 50 credits to ${report.corroboratorNames.length} reporter(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Verify",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "reports", report.id), { status: "verified" });
            const corrobSnap = await getDocs(
              query(collection(db, "reports"), where("originalReportId", "==", report.id))
            );
            for (const c of corrobSnap.docs) {
              await updateDoc(doc(db, "reports", c.id), { status: "verified" });
            }
            const allUserIds = Array.from(new Set(report.corroboratedBy));
            if (allUserIds.length === 0) allUserIds.push(report.userId);
            let count = 0;
            for (const uid of allUserIds) {
              const userRef = doc(db, "users", uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                await updateDoc(userRef, { credits: (userSnap.data()?.credits ?? 0) + 50 });
              } else {
                await setDoc(userRef, { credits: 50 }, { merge: true });
              }
              count++;
            }
            await updateDoc(doc(db, "reports", report.id), { creditsAwarded: true });
            for (const c of corrobSnap.docs) {
              await updateDoc(doc(db, "reports", c.id), { creditsAwarded: true });
            }
            Alert.alert("Verified ✅", `50 credits awarded to ${count} reporter${count > 1 ? "s" : ""}:\n${report.corroboratorNames.join(", ")}`);
            refresh();
          } catch (err: any) { Alert.alert("Error", err.message); }
        },
      },
    ]);
  };

  const rejectReport = async () => {
    Alert.alert("Reject Report", "Mark as fake/invalid? No credits will be awarded.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "reports", report.id), { status: "rejected" });
            const corrobSnap = await getDocs(
              query(collection(db, "reports"), where("originalReportId", "==", report.id))
            );
            for (const c of corrobSnap.docs) {
              await updateDoc(doc(db, "reports", c.id), { status: "rejected" });
            }
            Alert.alert("Rejected ❌", "Report rejected. No credits awarded.");
            refresh();
          } catch (err: any) { Alert.alert("Error", err.message); }
        },
      },
    ]);
  };

  const closeRepairReport = async () => {
    const confirmMsg = allConfirmed
      ? `3 users have confirmed the pothole at "${report.address}" is fixed.\n\nClose this report? It will be removed from the active map.`
      : `Only ${fixedVoteCount}/3 users have confirmed this is fixed so far.\n\nYou can still close it manually. Close this report?`;

    Alert.alert("Close Report ✅", confirmMsg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close Report ✅",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "reports", report.id), {
              repairedClosed: true,
              repairedClosedAt: new Date().toISOString(),
              repairVerificationPending: false,
            });
            const corrobSnap = await getDocs(
              query(collection(db, "reports"), where("originalReportId", "==", report.id))
            );
            for (const c of corrobSnap.docs) {
              await updateDoc(doc(db, "reports", c.id), { repairedClosed: true });
            }
            Alert.alert("Closed ✅", "Report officially closed. Pothole removed from the active map.");
            refresh();
          } catch (err: any) { Alert.alert("Error", err.message); }
        },
      },
    ]);
  };

  // Confirmation alert before clearing the closed card from view
  const handleClearClosed = () => {
    Alert.alert(
      "Clear Report",
      "Remove this closed report from view? It will no longer appear in the All Reports list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => onDismiss(report.id),
        },
      ]
    );
  };

  return (
    <View style={[
      styles.reportCard,
      isHighPriority && isPending     && styles.reportCardHighPriority,
      isRejected                      && styles.reportCardRejected,
      isRepairTab && showRepairAction && styles.reportCardRepair,
      isClosed                        && styles.reportCardClosed,
    ]}>
      <ImageViewerModal visible={viewerVisible} imageUrl={viewerImage} onClose={() => setViewerVisible(false)} />

      {report.imageUrl ? (
        <TouchableOpacity onPress={() => openImage(report.imageUrl)} activeOpacity={0.85}>
          <Image source={{ uri: report.imageUrl }} style={styles.reportImage} />
          <View style={styles.zoomHint}><Text style={styles.zoomHintText}>🔍</Text></View>
        </TouchableOpacity>
      ) : null}

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.address} numberOfLines={2}>{report.address}</Text>

        {report.description ? (
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionLabel}>📝 Notes:</Text>
            <Text style={styles.descriptionText}>{report.description}</Text>
          </View>
        ) : null}

        <View style={styles.reportersBox}>
          <Text style={styles.reportersLabel}>Reported by ({allNames.length}):</Text>
          {allNames.map((name, i) => (
            <Text key={i} style={styles.reporterName}>👤 {name}</Text>
          ))}
        </View>

        <Text style={[
          styles.statusText,
          report.status === "verified" && styles.statusVerified,
          report.status === "rejected" && styles.statusRejected,
        ]}>
          Status: {report.status.toUpperCase()}
        </Text>

        {isHighPriority && (
          <View style={styles.corrobBadge}>
            <Text style={styles.corrobText}>👥 {report.corroborationCount} users reported this</Text>
          </View>
        )}

        {isRepairTab && showRepairAction && (
          <View style={[styles.repairBadge, allConfirmed && styles.repairBadgeReady]}>
            <Text style={[styles.repairBadgeText, allConfirmed && styles.repairBadgeTextReady]}>
              {allConfirmed
                ? `✅ 3/3 users confirmed it's fixed!`
                : `🔧 ${fixedVoteCount}/3 users confirmed it's fixed`}
            </Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min((fixedVoteCount / 3) * 100, 100)}%` as any,
                    backgroundColor: allConfirmed ? "#16A34A" : "#D97706",
                  },
                ]}
              />
            </View>
          </View>
        )}

        {isClosed && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedBadgeText}>✅ Officially Closed — Removed from map</Text>
          </View>
        )}

        {report.corroboratorImages?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {report.corroboratorImages.map((imgUrl, i) => (
              <TouchableOpacity key={i} onPress={() => openImage(imgUrl)} activeOpacity={0.8}>
                <Image source={{ uri: imgUrl }} style={styles.corrobThumb} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={[
          styles.creditBadge,
          report.creditsAwarded ? styles.creditAwarded
            : isRejected ? styles.creditRejected
            : styles.creditYes
        ]}>
          {report.creditsAwarded
            ? `✓ 50 Credits awarded to all ${allNames.length} reporter${allNames.length > 1 ? "s" : ""}`
            : isRejected ? "✗ Rejected — no credits awarded"
            : `⭐ 50 Credits pending for ${allNames.length} reporter${allNames.length > 1 ? "s" : ""}`}
        </Text>
      </View>

      {/* Action buttons column — verify/reject for pending, close for repair, clear X for closed */}
      <View style={styles.actionButtons}>
        {isPending && (
          <>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#22c55e" }]} onPress={verifyReport}>
              <CheckCircle color="white" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#EF4444", marginTop: 8 }]} onPress={rejectReport}>
              <XCircle color="white" size={20} />
            </TouchableOpacity>
          </>
        )}
        {isRepairTab && showRepairAction && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: allConfirmed ? "#16A34A" : "#94A3B8", marginTop: isPending ? 8 : 0 }]}
            onPress={closeRepairReport}
            activeOpacity={0.8}
          >
            <CheckCircle color="white" size={20} />
          </TouchableOpacity>
        )}
        {/* Circular red X button for closed cards — same style as reject button */}
        {isClosed && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#EF4444" }]}
            onPress={handleClearClosed}
            activeOpacity={0.8}
          >
            <XCircle color="white" size={20} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  header: {
    backgroundColor: "#064E3B",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 10 : 32,
    paddingBottom: 24,
    borderRadius: 22,
    marginHorizontal: 3,
    marginTop: 6,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "white", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#A7F3D0", marginTop: 4 },
  profile: { backgroundColor: "rgba(255,255,255,0.2)", padding: 12, borderRadius: 999 },
  tabContainer: { flexDirection: "row", margin: 20, backgroundColor: "#E2E8F0", borderRadius: 16 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#10ad79", borderRadius: 16 },
  tabText: { fontWeight: "600", color: "#475569" },
  tabTextActive: { color: "white" },
  section: { paddingHorizontal: 20, marginTop: 0 },
  card: { padding: 15, borderRadius: 18, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBubble: { backgroundColor: "rgba(0,0,0,0.06)", padding: 14, borderRadius: 14 },
  cardLabel: { fontWeight: "700", color: "#0F172A" },
  cardValue: { fontSize: 24, fontWeight: "900", color: "#111827" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#111827" },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#E2E8F0", marginRight: 8 },
  filterChipActive: { backgroundColor: "#10B981" },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  filterChipTextActive: { color: "white" },
  emptyText: { color: "#9CA3AF", fontStyle: "italic", textAlign: "center", marginTop: 40 },
  reportCard: { backgroundColor: "white", padding: 16, borderRadius: 18, marginBottom: 14, flexDirection: "row", alignItems: "flex-start" },
  reportCardHighPriority: { borderWidth: 1.5, borderColor: "#FCA5A5", backgroundColor: "#FFF7F7" },
  reportCardRejected: { borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", opacity: 0.7 },
  reportCardRepair: { borderWidth: 1.5, borderColor: "#FCD34D", backgroundColor: "#FFFBEB" },
  reportCardClosed: { borderWidth: 1.5, borderColor: "#86EFAC", backgroundColor: "#F0FDF4", opacity: 0.85 },
  reportImage: { width: 80, height: 80, borderRadius: 12 },
  zoomHint: { position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  zoomHintText: { fontSize: 11 },
  address: { fontWeight: "700", fontSize: 13 },
  descriptionBox: {
    marginTop: 6, marginBottom: 4, backgroundColor: "#F8FAFC",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
    borderLeftWidth: 3, borderLeftColor: "#93C5FD",
  },
  descriptionLabel: { fontSize: 10, fontWeight: "700", color: "#6B7280", marginBottom: 2 },
  descriptionText: { fontSize: 12, color: "#1E293B", lineHeight: 17 },
  reportersBox: { marginTop: 4, marginBottom: 2 },
  reportersLabel: { fontSize: 11, color: "#6b7280", fontWeight: "600", marginBottom: 2 },
  reporterName: { fontSize: 12, color: "#111827", fontWeight: "500", marginTop: 2 },
  statusText: { marginTop: 4, color: "#555", fontSize: 12, fontWeight: "600" },
  statusVerified: { color: "#16A34A" },
  statusRejected: { color: "#DC2626" },
  corrobBadge: { marginTop: 6, backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  corrobText: { fontSize: 11, fontWeight: "700", color: "#DC2626" },
  repairBadge: { marginTop: 6, backgroundColor: "#FEF3C7", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#FCD34D" },
  repairBadgeReady: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
  repairBadgeText: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  repairBadgeTextReady: { color: "#15803D" },
  progressBarContainer: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 999, marginTop: 6, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 999 },
  closedBadge: { marginTop: 6, backgroundColor: "#DCFCE7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  closedBadgeText: { fontSize: 11, fontWeight: "700", color: "#15803D" },
  corrobThumb: { width: 40, height: 40, borderRadius: 6, marginRight: 6, borderWidth: 1, borderColor: "#E5E7EB" },
  creditBadge: { marginTop: 6, fontSize: 11, fontWeight: "600" },
  creditAwarded: { color: "#059669" },
  creditYes: { color: "#D97706" },
  creditRejected: { color: "#9CA3AF" },
  actionButtons: { flexDirection: "column", alignItems: "center", marginLeft: 10 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  closeBtn: { position: "absolute", top: 60, right: 20, zIndex: 10 },
  fullImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});
