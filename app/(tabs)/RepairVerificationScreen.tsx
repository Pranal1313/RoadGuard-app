import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Platform,
  TouchableOpacity, Image, Alert, Modal, Dimensions,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { CheckCircle, MapPin, X, ThumbsUp } from "lucide-react-native";
import {
  collection, getDocs, doc, updateDoc, query, where, arrayUnion,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type RepairStatus = "repaired_pending_admin" | "closed" | "unknown";

type PotholeReport = {
  id: string;
  address: string;
  imageUrl: string;
  corroborationCount: number;
  repairStatus: RepairStatus;
  fixedVotes: string[];
  reporterIds: string[];
  reporterVerified: boolean;
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

export default function RepairVerificationScreen() {
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "closed">("all");

  const currentUserId = auth.currentUser?.uid ?? "";

  const fetchReports = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "reports"), where("status", "==", "verified"))
      );

      const loaded: PotholeReport[] = snap.docs
        .map((docSnap) => {
          const d = docSnap.data() as any;
          if (d.isCorroboration === true) return null;

          const fixedVotes: string[] = d.fixedVotes ?? [];
          const reporterIds: string[] = d.corroboratedBy && d.corroboratedBy.length > 0
            ? d.corroboratedBy : [d.userId];

          // ✅ Only include reports where current user is one of the reporters
          if (!reporterIds.includes(currentUserId)) return null;

          const reporterVerified = reporterIds.some((uid: string) => fixedVotes.includes(uid));

          let repairStatus: RepairStatus = "unknown";
          if (d.repairedClosed === true) repairStatus = "closed";
          else if (reporterVerified) repairStatus = "repaired_pending_admin";

          return {
            id: docSnap.id,
            address: d.location || d.address || "Unknown Location",
            imageUrl: d.imageUrl || "",
            corroborationCount: d.corroborationCount ?? 1,
            repairStatus,
            fixedVotes,
            reporterIds,
            reporterVerified,
          };
        })
        .filter(Boolean) as PotholeReport[];

      // Sort: unknown first, pending admin next, closed last
      const order = { unknown: 0, repaired_pending_admin: 1, closed: 2 };
      loaded.sort((a, b) => order[a.repairStatus] - order[b.repairStatus]);

      setReports(loaded);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load your reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  const onRefresh = () => { setRefreshing(true); fetchReports(); };

  const handleVote = async (reportId: string) => {
    if (!currentUserId) {
      Alert.alert("Not logged in", "You need to be logged in to vote.");
      return;
    }

    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    if (report.fixedVotes.includes(currentUserId)) {
      Alert.alert("Already confirmed", "You have already marked this pothole as fixed.");
      return;
    }

    Alert.alert(
      "Confirm Repair ✅",
      "Are you sure this pothole has been repaired? Your confirmation will notify the admin to officially close this report.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, It's Fixed!",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "reports", reportId), {
                fixedVotes: arrayUnion(currentUserId),
                repairVerificationPending: true,
                repairVerifiedBy: currentUserId,
                repairVerifiedAt: new Date().toISOString(),
              });
              Alert.alert("Thanks! 🎉", "The admin has been notified to review and officially close this report.");
              await fetchReports();
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  const filteredReports = reports.filter((r) => {
    if (activeFilter === "all") return true;
    return r.repairStatus === "closed";
  });

  const closedCount = reports.filter((r) => r.repairStatus === "closed").length;
  const openCount = reports.filter((r) => r.repairStatus !== "closed").length;

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#064E3B" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Reports</Text>
        <Text style={styles.headerSubtitle}>Confirm when your reported potholes are fixed</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Text style={styles.summaryNum}>{reports.length}</Text>
            <Text style={styles.summaryLabel}>My Reports</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: "rgba(251,191,36,0.2)" }]}>
            <Text style={styles.summaryNum}>{openCount}</Text>
            <Text style={styles.summaryLabel}>Open 🕐</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: "rgba(34,197,94,0.25)" }]}>
            <Text style={styles.summaryNum}>{closedCount}</Text>
            <Text style={styles.summaryLabel}>Closed ✅</Text>
          </View>
        </View>
      </View>

      {/* Filter chips — only All + Closed */}
      <View style={styles.filterRow}>
        {(["all", "closed"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
              {f === "all" ? "All" : "✅ Closed"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading your reports...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
        >
          {filteredReports.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🛣️</Text>
              <Text style={styles.emptyTitle}>
                {reports.length === 0 ? "No verified reports yet" : "No closed reports yet"}
              </Text>
              <Text style={styles.emptyDesc}>
                {reports.length === 0
                  ? "Once your reported potholes are verified by the admin, they'll appear here for you to confirm repairs."
                  : "When the admin officially closes a repair, it will appear here."}
              </Text>
            </View>
          ) : (
            filteredReports.map((report) => (
              <ReportVoteCard
                key={report.id}
                report={report}
                currentUserId={currentUserId}
                onVote={handleVote}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ReportVoteCard({ report, currentUserId, onVote }: {
  report: PotholeReport; currentUserId: string; onVote: (id: string) => void;
}) {
  const [viewerVisible, setViewerVisible] = useState(false);

  const hasVoted = report.fixedVotes.includes(currentUserId);
  const isClosed = report.repairStatus === "closed";
  const isPending = report.repairStatus === "repaired_pending_admin";

  const cardStyle = isClosed ? styles.cardClosed
    : isPending ? styles.cardPending
    : styles.cardUnknown;

  return (
    <View style={[styles.card, cardStyle]}>
      <ImageViewerModal visible={viewerVisible} imageUrl={report.imageUrl} onClose={() => setViewerVisible(false)} />

      {/* Top row */}
      <View style={styles.cardTop}>
        {report.imageUrl ? (
          <TouchableOpacity onPress={() => setViewerVisible(true)} activeOpacity={0.85}>
            <Image source={{ uri: report.imageUrl }} style={styles.thumb} />
            <View style={styles.zoomBadge}><Text style={styles.zoomText}>🔍</Text></View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <MapPin color="#94A3B8" size={28} />
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.address} numberOfLines={2}>{report.address}</Text>

          <View style={[styles.statusBadge, {
            backgroundColor: isClosed ? "#16A34A" : isPending ? "#D97706" : "#64748B"
          }]}>
            <Text style={styles.statusBadgeText}>
              {isClosed ? "✅ Officially Closed"
                : isPending ? "🔔 Awaiting Admin Review"
                : "🕐 Not yet confirmed"}
            </Text>
          </View>
        </View>
      </View>

      {/* Action area */}
      {isClosed ? (
        <View style={styles.closedBanner}>
          <Text style={styles.closedBannerText}>🎉 Admin has officially closed this report. Thank you for helping!</Text>
        </View>
      ) : isPending || hasVoted ? (
        <View style={styles.votedBanner}>
          <CheckCircle size={14} color="#059669" />
          <Text style={styles.votedText}>You confirmed this as fixed. Waiting for admin to officially close it.</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.fixedBtn} onPress={() => onVote(report.id)} activeOpacity={0.8}>
          <ThumbsUp color="white" size={16} />
          <Text style={styles.fixedBtnText}>I confirm it's fixed!</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  header: {
    backgroundColor: "#064E3B",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 10 : 52,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: { color: "white", fontSize: 22, fontWeight: "800" },
  headerSubtitle: { color: "#A7F3D0", marginTop: 4, fontSize: 13 },
  summaryRow: { flexDirection: "row", marginTop: 16, gap: 8 },
  summaryPill: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: "center" },
  summaryNum: { color: "white", fontSize: 18, fontWeight: "800" },
  summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  filterRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: "#E2E8F0" },
  filterChipActive: { backgroundColor: "#064E3B" },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  filterChipTextActive: { color: "white" },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#64748B", fontSize: 14 },
  emptyBox: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B", marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 4 },
  card: {
    borderRadius: 20, borderWidth: 1.5, marginBottom: 16, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardClosed: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
  cardPending: { backgroundColor: "#FFFBEB", borderColor: "#FCD34D" },
  cardUnknown: { backgroundColor: "white", borderColor: "#E2E8F0" },
  cardTop: { flexDirection: "row", gap: 12, marginBottom: 14 },
  thumb: { width: 80, height: 80, borderRadius: 12 },
  thumbPlaceholder: { backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center" },
  zoomBadge: { position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  zoomText: { fontSize: 10 },
  cardInfo: { flex: 1, justifyContent: "space-between" },
  address: { fontSize: 13, fontWeight: "700", color: "#0F172A", lineHeight: 18 },
  statusBadge: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: "700", color: "white" },
  fixedBtn: {
    flexDirection: "row", backgroundColor: "#10B981", paddingVertical: 12,
    borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 8,
  },
  fixedBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
  votedBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFFBEB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#FCD34D" },
  votedText: { fontSize: 12, color: "#92400E", fontWeight: "600", flex: 1 },
  closedBanner: { backgroundColor: "#DCFCE7", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center" },
  closedBannerText: { fontSize: 13, color: "#15803D", fontWeight: "700", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  closeBtn: { position: "absolute", top: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 12 : 56, right: 20, zIndex: 10, backgroundColor: "rgba(255,255,255,0.15)", padding: 8, borderRadius: 999 },
  fullImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});
