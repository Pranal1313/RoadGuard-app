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
  const [activeFilter, setActiveFilter] = useState<"open" | "closed">("open");

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

          let repairStatus: RepairStatus = "unknown";
          if (d.repairedClosed === true) repairStatus = "closed";
          else if (d.repairVerificationPending === true) repairStatus = "repaired_pending_admin";

          return {
            id: docSnap.id,
            address: d.location || d.address || "Unknown Location",
            imageUrl: d.imageUrl || "",
            corroborationCount: d.corroborationCount ?? 1,
            repairStatus,
            fixedVotes,
          };
        })
        .filter(Boolean) as PotholeReport[];

      const order = { unknown: 0, repaired_pending_admin: 1, closed: 2 };
      loaded.sort((a, b) => order[a.repairStatus] - order[b.repairStatus]);

      setReports(loaded);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

    const newVoteCount = report.fixedVotes.length + 1;

    Alert.alert(
      "Confirm Repair ✅",
      "Have you seen this pothole repaired? Your confirmation helps notify the admin to close this report.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, It's Fixed!",
          onPress: async () => {
            try {
              const shouldNotifyAdmin = newVoteCount >= 3;

              // FIX: Always set repairVerificationPending=true from the FIRST vote
              // so admin can see it immediately, not just after 3 votes
              await updateDoc(doc(db, "reports", reportId), {
                fixedVotes: arrayUnion(currentUserId),
                repairVerificationPending: true,           // ← always set on first vote
                repairVerifiedAt: new Date().toISOString(),
              });

              if (shouldNotifyAdmin) {
                Alert.alert("Thanks! 🎉", "3 users have now confirmed this pothole is fixed. The admin has been notified.");
              } else {
                const remaining = 3 - newVoteCount;
                Alert.alert("Vote recorded ✅", `Thanks! ${newVoteCount}/3 confirmations so far. ${remaining} more needed to notify the admin.`);
              }
              await fetchReports();
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  // Open = not closed (includes unknown + pending admin)
  const filteredReports = reports.filter((r) =>
    activeFilter === "closed"
      ? r.repairStatus === "closed"
      : r.repairStatus !== "closed"
  );

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#042262" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Repair Verification</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.subText}>Has this pothole been fixed?</Text>
          <Text style={styles.subText}>Let the community know</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === "open" && styles.filterChipActive]}
          onPress={() => setActiveFilter("open")}
        >
          <Text style={[styles.filterChipText, activeFilter === "open" && styles.filterChipTextActive]}>
            🕐 Open
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === "closed" && styles.filterChipActive]}
          onPress={() => setActiveFilter("closed")}
        >
          <Text style={[styles.filterChipText, activeFilter === "closed" && styles.filterChipTextActive]}>
            ✅ Closed
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#042262" />
          <Text style={styles.loadingText}>Loading verified potholes...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#042262" />}
        >
          {filteredReports.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🛣️</Text>
              <Text style={styles.emptyTitle}>
                {activeFilter === "closed" ? "No closed reports yet" : "No open reports"}
              </Text>
              <Text style={styles.emptyDesc}>
                {activeFilter === "closed"
                  ? "Closed reports will appear here once the admin officially closes them."
                  : "Once potholes are verified by the admin they will appear here."}
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
  const voteCount = report.fixedVotes.length;
  const isClosed = report.repairStatus === "closed";

  // FIX: All non-closed cards use the same neutral white style — no yellow
  return (
    <View style={[styles.card, isClosed ? styles.cardClosed : styles.cardOpen]}>
      <ImageViewerModal visible={viewerVisible} imageUrl={report.imageUrl} onClose={() => setViewerVisible(false)} />

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
            backgroundColor: isClosed ? "#16A34A" : "#64748B",
          }]}>
            <Text style={styles.statusBadgeText}>
              {isClosed ? "✅ Officially Closed" : "🕐 Not yet confirmed"}
            </Text>
          </View>
        </View>
      </View>

      {/* Vote progress bar — always shown for open cards */}
      {!isClosed && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${Math.min((voteCount / 3) * 100, 100)}%` as any,
              backgroundColor: voteCount >= 3 ? "#16A34A" : "#042262",
            }]} />
          </View>
          <Text style={styles.progressText}>
            {voteCount}/3 confirmations{voteCount >= 3 ? " — Admin notified" : ` · ${3 - voteCount} more needed`}
          </Text>
        </View>
      )}

      {isClosed ? (
        <View style={styles.closedBanner}>
          <Text style={styles.closedBannerText}>🎉 Admin has officially closed this report. Pothole resolved!</Text>
        </View>
      ) : hasVoted ? (
        <View style={styles.votedBanner}>
          <CheckCircle size={14} color="#059669" />
          <Text style={styles.votedText}>You confirmed this as fixed. Thank you!</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.fixedBtn} onPress={() => onVote(report.id)} activeOpacity={0.8}>
          <ThumbsUp color="white" size={16} />
          <Text style={styles.fixedBtnText}>It's Fixed!</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },
  header: {
    backgroundColor: '#042262',
    paddingHorizontal: 19,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 23,
    paddingBottom: 28,
    borderRadius: 22,
    marginHorizontal: 3,
    marginTop: 6,
  },
  headerRow: { marginBottom: 16 },
  title: { color: 'white', fontSize: 20, fontWeight: '600' },
  summaryCard: { backgroundColor: 'rgba(133,125,125,0.15)', borderRadius: 20, padding: 16 },
  subText: { color: '#DBEAFE', fontSize: 13 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, gap: 10 },
  filterChip: { flex: 1, paddingVertical: 10, borderRadius: 20, backgroundColor: '#E2E8F0', alignItems: 'center' },
  filterChipActive: { backgroundColor: '#042262' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: 'white' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 4 },
  card: {
    borderRadius: 18, borderWidth: 1.5, marginBottom: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  // FIX: cardPending removed — only two states: open (white) and closed (green)
  cardClosed: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  cardOpen:   { backgroundColor: 'white',   borderColor: '#E2E8F0' },   // ← replaces cardUnknown + cardPending
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  thumb: { width: 80, height: 80, borderRadius: 12 },
  thumbPlaceholder: { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  zoomBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  zoomText: { fontSize: 10 },
  cardInfo: { flex: 1 },
  address: { fontSize: 13, fontWeight: '700', color: '#0F172A', lineHeight: 18 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: 'white' },
  progressRow: { marginBottom: 12, gap: 6 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  fixedBtn: {
    flexDirection: 'row', backgroundColor: '#042262', paddingVertical: 12,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  fixedBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  votedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  votedText: { fontSize: 12, color: '#059669', fontWeight: '600', flex: 1 },
  closedBanner: { backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  closedBannerText: { fontSize: 13, color: '#15803D', fontWeight: '700', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 56, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', padding: 8, borderRadius: 999 },
  fullImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});
