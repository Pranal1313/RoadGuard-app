
// Lets reporters confirm whether a pothole they reported has been fixed.
// Shows their verified reports in two tabs: "All" (open) and "Closed".
// Reporters tap "I confirm it's fixed!" to notify the admin.


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

// Three possible states for a report's repair progress
type RepairStatus = "repaired_pending_admin" | "closed" | "unknown";

// Shape of each pothole report card shown on this screen
type PotholeReport = {
  id: string;
  address: string;
  imageUrl: string;
  corroborationCount: number;  // how many users reported the same pothole
  repairStatus: RepairStatus;
  fixedVotes: string[];        // user IDs who confirmed the fix
  reporterIds: string[];       // user IDs who originally reported this pothole
  reporterVerified: boolean;   // true if the current user already voted it fixed
};

// ── Full-screen image viewer modal ──────────────────────────────────────────
// Shown when the user taps the thumbnail on a report card
function ImageViewerModal({ visible, imageUrl, onClose }: {
  visible: boolean; imageUrl: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Close button in the top-right corner */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={26} color="white" />
        </TouchableOpacity>
        {/* Full-screen image with contain so nothing gets cropped */}
        <Image source={{ uri: imageUrl }} style={styles.fullImage} resizeMode="contain" />
      </View>
    </Modal>
  );
}

// ── Main screen component ────────────────────────────────────────────────────
export default function RepairVerificationScreen() {
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // "all" tab shows open/pending reports; "closed" shows officially closed ones
  const [activeFilter, setActiveFilter] = useState<"all" | "closed">("all");

  // UID of the currently logged-in user (used for filtering and voting)
  const currentUserId = auth.currentUser?.uid ?? "";

  // ── Fetch verified reports that belong to this user ────────────────────────
  const fetchReports = useCallback(async () => {
    try {
      // Only load reports that have been verified by an admin
      const snap = await getDocs(
        query(collection(db, "reports"), where("status", "==", "verified"))
      );

      const loaded: PotholeReport[] = snap.docs
        .map((docSnap) => {
          const d = docSnap.data() as any;

          // Skip corroboration sub-documents; we only want master reports
          if (d.isCorroboration === true) return null;

          const fixedVotes: string[] = d.fixedVotes ?? [];

          // reporterIds = corroborators if they exist, otherwise just the original reporter
          const reporterIds: string[] = d.corroboratedBy && d.corroboratedBy.length > 0
            ? d.corroboratedBy : [d.userId];

          // Only include this report if the current user was one of the reporters
          if (!reporterIds.includes(currentUserId)) return null;

          // Did the current user (or any reporter) already vote this as fixed?
          const reporterVerified = reporterIds.some((uid: string) => fixedVotes.includes(uid));

          // Determine repair status from Firestore flags
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
        .filter(Boolean) as PotholeReport[]; // remove null entries

      // Sort so "unknown" (needs action) appears first, "closed" last
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

  // Fetch on mount
  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Pull-to-refresh handler
  const onRefresh = () => { setRefreshing(true); fetchReports(); };

  // ── Handle "I confirm it's fixed" vote ────────────────────────────────────
  const handleVote = async (reportId: string) => {
    if (!currentUserId) {
      Alert.alert("Not logged in", "You need to be logged in to vote.");
      return;
    }

    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    // Prevent duplicate votes
    if (report.fixedVotes.includes(currentUserId)) {
      Alert.alert("Already confirmed", "You have already marked this pothole as fixed.");
      return;
    }

    // Confirm with the user before writing to Firestore
    Alert.alert(
      "Confirm Repair ✅",
      "Are you sure this pothole has been repaired? Your confirmation will notify the admin to officially close this report.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, It's Fixed!",
          onPress: async () => {
            try {
              // Add this user's ID to fixedVotes and flag report for admin review
              await updateDoc(doc(db, "reports", reportId), {
                fixedVotes: arrayUnion(currentUserId),
                repairVerificationPending: true,
                repairVerifiedBy: currentUserId,
                repairVerifiedAt: new Date().toISOString(),
              });
              Alert.alert("Thanks! 🎉", "The admin has been notified to review and officially close this report.");
              await fetchReports(); // refresh the list
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  // ── Tab filtering logic ────────────────────────────────────────────────────
  // "All" tab → hides closed reports (only shows open/pending)
  // "Closed" tab → shows only officially closed reports
  const filteredReports = reports.filter((r) => {
    if (activeFilter === "closed") return r.repairStatus === "closed";
    return r.repairStatus !== "closed";
  });

  // Summary counts for the header pills
  const closedCount = reports.filter((r) => r.repairStatus === "closed").length;
  const openCount = reports.filter((r) => r.repairStatus !== "closed").length;

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#064E3B" />

      {/* ── Header with summary pills ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Reports</Text>
        <Text style={styles.headerSubtitle}>Confirm when your reported potholes are fixed</Text>

        {/* Three summary pills: total, open, closed */}
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

      {/* ── Filter tab chips (All / Closed) ── */}
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

      {/* ── Content: loading spinner or scrollable list ── */}
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
            // ── Empty state with contextual message ──
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🛣️</Text>
              <Text style={styles.emptyTitle}>
                {activeFilter === "closed"
                  ? "No closed reports yet"
                  : reports.length === 0
                  ? "No verified reports yet"
                  : "No open reports"}
              </Text>
              <Text style={styles.emptyDesc}>
                {activeFilter === "closed"
                  ? "When the admin officially closes a repair, it will appear here."
                  : reports.length === 0
                  ? "Once your reported potholes are verified by the admin, they'll appear here for you to confirm repairs."
                  : "All your reports have been closed. Check the Closed tab."}
              </Text>
            </View>
          ) : (
            // ── Render a card for each filtered report ──
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

// ── Individual report card ────────────────────────────────────────────────────
// Shows the photo, address, status badge, and the confirm/vote button
function ReportVoteCard({ report, currentUserId, onVote }: {
  report: PotholeReport; currentUserId: string; onVote: (id: string) => void;
}) {
  // Controls visibility of the full-screen image viewer
  const [viewerVisible, setViewerVisible] = useState(false);

  const hasVoted = report.fixedVotes.includes(currentUserId); // user already confirmed fix
  const isClosed = report.repairStatus === "closed";           // admin officially closed it
  const isPending = report.repairStatus === "repaired_pending_admin"; // waiting for admin

  // Pick a card background/border style based on repair status
  const cardStyle = isClosed ? styles.cardClosed
    : isPending ? styles.cardPending
    : styles.cardUnknown;

  return (
    <View style={[styles.card, cardStyle]}>
      {/* Full-screen image viewer (shown on thumbnail tap) */}
      <ImageViewerModal visible={viewerVisible} imageUrl={report.imageUrl} onClose={() => setViewerVisible(false)} />

      {/* ── Top row: thumbnail + address + status badge ── */}
      <View style={styles.cardTop}>
        {report.imageUrl ? (
          // Tappable thumbnail that opens the full-screen viewer
          <TouchableOpacity onPress={() => setViewerVisible(true)} activeOpacity={0.85}>
            <Image source={{ uri: report.imageUrl }} style={styles.thumb} />
            {/* Small zoom icon overlay on the thumbnail */}
            <View style={styles.zoomBadge}><Text style={styles.zoomText}>🔍</Text></View>
          </TouchableOpacity>
        ) : (
          // Placeholder when no image is available
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <MapPin color="#94A3B8" size={28} />
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.address} numberOfLines={2}>{report.address}</Text>

          {/* Coloured badge showing current repair status */}
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

      {/* ── Bottom action area (varies by status) ── */}
      {isClosed ? (
        // Admin has closed the report — show a celebration banner
        <View style={styles.closedBanner}>
          <Text style={styles.closedBannerText}>🎉 Admin has officially closed this report. Thank you for helping!</Text>
        </View>
      ) : isPending || hasVoted ? (
        // User already voted; waiting for admin action
        <View style={styles.votedBanner}>
          <CheckCircle size={14} color="#059669" />
          <Text style={styles.votedText}>You confirmed this as fixed. Waiting for admin to officially close it.</Text>
        </View>
      ) : (
        // Primary CTA: user hasn't voted yet
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
    backgroundColor: "#042262",
    paddingHorizontal: 20,
    // Push content below the Android status bar
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 10 : 32,
    paddingBottom: 24,
    borderRadius: 22,
    marginHorizontal: 3,
    marginTop: 6,
  },
  headerTitle: { color: "white", fontSize: 22, fontWeight: "800" },
  headerSubtitle: { color: "#a1dbff", marginTop: 4, fontSize: 13 },
  summaryRow: { flexDirection: "row", marginTop: 16, gap: 8, marginBottom: 6 },
  summaryPill: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: "center" },
  summaryNum: { color: "white", fontSize: 18, fontWeight: "800" },
  summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  filterRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginTop: 5, backgroundColor: "#E2E8F0" },
  filterChipActive: { backgroundColor: "#446dac" },
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
    borderRadius: 25,
    marginBottom: 16,
    marginTop: 7,
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  // Card border colours communicate status at a glance
  cardClosed: { backgroundColor: "#e7f2f8", borderColor: "#446dac", borderWidth: 2 },
  cardPending: { backgroundColor: "#FFFBEB", borderColor: "#FCD34D", borderWidth: 2 },
  cardUnknown: { backgroundColor: "#FFF7D6", borderColor: "#F59E0B", borderWidth: 2 },
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
  closedBanner: {
    backgroundColor: "#b7dff7",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  closedBannerText: { fontSize: 13, color: "#29466d", fontWeight: "700", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  closeBtn: { position: "absolute", top: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 12 : 56, right: 20, zIndex: 10, backgroundColor: "rgba(255,255,255,0.15)", padding: 8, borderRadius: 999 },
  fullImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});
