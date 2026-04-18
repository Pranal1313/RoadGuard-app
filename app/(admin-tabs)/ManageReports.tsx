// Dashboard tab — clickable summary cards (total, pending, verified,
//   rejected, multi-user, repair-pending). .

//     • Verify a pending report (awards 50 credits to all reporters)
//     • Reject a pending report (no credits)
//     • Close a repair-verified report (removes it from the active map)


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

// Possible admin-assigned statuses for a report
type ReportStatus = "pending" | "verified" | "rejected";

// Filter chips available in the Reports tab
type ReportFilter = "multiuser" | "repair" | "all" | "pending" | "verified" | "rejected";

// Full shape of a report document as used by this screen
type Report = {
  id: string;
  address: string;
  userId: string;
  userName: string;               // name of the original reporter
  status: ReportStatus;
  imageUrl: string;
  creditEligible: boolean;
  creditsAwarded: boolean;
  corroborationCount: number;     // how many users reported this same pothole
  corroboratedBy: string[];       // UIDs of all reporters
  corroboratorNames: string[];    // display names matched from Firestore users collection
  corroboratorImages: string[];   // photos submitted by each corroborating user
  isCorroboration: boolean;       // true = this is a sub-doc, not the master
  repairVerificationPending: boolean; // reporter(s) flagged it as fixed, awaiting admin
  repairedClosed: boolean;        // admin officially closed this report
  repairVerifiedAt?: string;      // ISO timestamp of when reporter(s) voted it fixed
  fixedVotes: string[];           // UIDs of reporters who confirmed the fix
};

// ── Full-screen image viewer modal ────────────────────────────────────────────
// Shown when admin taps a report thumbnail or a corroborator thumbnail
function ImageViewerModal({ visible, imageUrl, onClose }: {
  visible: boolean; imageUrl: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Close button top-right */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={26} color="white" />
        </TouchableOpacity>
        {/* Full-resolution image with contain so nothing is cropped */}
        <Image source={{ uri: imageUrl }} style={styles.fullImage} resizeMode="contain" />
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminDashboardScreen() {
  // "Dashboard" shows summary cards; "Reports" shows the filterable list
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Reports">("Dashboard");

  // Which filter chip is active in the Reports tab
  const [activeFilter, setActiveFilter] = useState<ReportFilter>("multiuser");

  // All master (non-corroboration) reports fetched from Firestore
  const [reports, setReports] = useState<Report[]>([]);

  // ── Fetch reports + resolve reporter names ────────────────────────────────
  const fetchReports = async () => {
    try {
      // Step 1: Build a uid → displayName lookup from the users collection
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap: Record<string, string> = {};
      usersSnap.docs.forEach((d) => {
        const data = d.data() as any;
        usersMap[d.id] = data.fullName || "Unknown";
      });

      // Step 2: Fetch all reports sorted oldest→newest (for consistent ordering)
      const reportsSnap = await getDocs(
        query(collection(db, "reports"), orderBy("createdAt", "asc"))
      );

      const loaded: Report[] = reportsSnap.docs
        .map((docSnap) => {
          const d = docSnap.data() as any;

          // corroboratedBy holds all reporter UIDs; fall back to just the original userId
          const corroboratedBy: string[] = d.corroboratedBy && d.corroboratedBy.length > 0
            ? d.corroboratedBy : [d.userId];

          // Resolve UIDs to display names using the usersMap built above
          const corroboratorNames = corroboratedBy.map(
            (uid: string) => usersMap[uid] || "Unknown User"
          );

          return {
            id: docSnap.id,
            userId: d.userId,
            userName: usersMap[d.userId] || "Anonymous",
            address: d.location || d.address || "Unknown Location",
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
        // Only keep master reports — skip corroboration sub-documents
        .filter((r) => !r.isCorroboration);

      setReports(loaded);
    } catch (err) {
      Alert.alert("Error", "Failed to load reports");
      console.error(err);
    }
  };

  // Fetch on mount
  useEffect(() => { fetchReports(); }, []);

  // ── Derived counts for dashboard summary cards ────────────────────────────
  const total = reports.length;
  const pending = reports.filter((r) => r.status === "pending").length;
  const verified = reports.filter((r) => r.status === "verified").length;
  const rejected = reports.filter((r) => r.status === "rejected").length;
  const multi = reports.filter((r) => r.corroborationCount >= 2).length;           // 2+ users same pothole
  const repairPending = reports.filter(
    (r) => r.repairVerificationPending && !r.repairedClosed                         // flagged fixed, not yet closed
  ).length;

  // ── Switch to Reports tab pre-filtered to the tapped dashboard card ───────
  const goToReports = (filter: ReportFilter) => {
    setActiveFilter(filter);
    setActiveTab("Reports");
  };

  // ── Filter the report list based on the active chip ───────────────────────
  const filteredReports = reports.filter((r) => {
    if (activeFilter === "multiuser") return r.corroborationCount >= 2;
    if (activeFilter === "repair")    return r.repairVerificationPending && !r.repairedClosed;
    if (activeFilter === "all")       return true;
    return r.status === activeFilter; // "pending" | "verified" | "rejected"
  });

  // Human-readable label for the currently active filter (shown above the list)
  const filterLabel: Record<ReportFilter, string> = {
    multiuser: "Multi-User Reports 👥",
    repair:    "Repair Requests 🔧",
    all:       "All Reports",
    pending:   "Pending Reports",
    verified:  "Verified Reports",
    rejected:  "Rejected Reports",
  };

  // Order in which filter chips are displayed (left → right)
  const filterOrder: ReportFilter[] = ["multiuser", "repair", "all", "pending", "verified", "rejected"];

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Dark green header ── */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>RoadGuard Admin</Text>
              <Text style={styles.subtitle}>Executive Management Panel</Text>
            </View>
            {/* Admin avatar bubble (decorative) */}
            <View style={styles.profile}>
              <User color="white" size={22} />
            </View>
          </View>
        </View>

        {/* ── Tab switcher: Dashboard / Reports ── */}
        <View style={styles.tabContainer}>
          <TabButton label="Dashboard" active={activeTab === "Dashboard"} onPress={() => setActiveTab("Dashboard")} />
          <TabButton label="Reports"   active={activeTab === "Reports"}   onPress={() => setActiveTab("Reports")}   />
        </View>

        {/* ── Conditional content by active tab ── */}
        {activeTab === "Dashboard" ? (
          // ── Dashboard tab: clickable summary cards ──
          <View style={styles.section}>
            {/* Only show repair card if there are pending repair requests */}
            {repairPending > 0 && (
              <DashboardCard
                icon={<CheckCircle color="#92400E" size={13} />}
                label="Repair Requests 🔧"
                value={repairPending}
                color="#FEF3C7" // amber background = needs attention
                onPress={() => goToReports("repair")}
              />
            )}
            <DashboardCard icon={<Flame color="#C2410C" size={13} />}      label="Multi-User Reports  👥" value={multi}    color="#e7f7ec" onPress={() => goToReports("multiuser")} />
            <DashboardCard icon={<MapPin color="#065F46" size={13} />}     label="Total Reports"          value={total}    color="#e7f7ec" onPress={() => goToReports("all")}       />
            <DashboardCard icon={<AlertCircle color="#065F46" size={13} />} label="Pending Reports"       value={pending}  color="#e7f7ec" onPress={() => goToReports("pending")}   />
            <DashboardCard icon={<CheckCircle color="#065F46" size={13} />} label="Verified Reports"      value={verified} color="#e7f7ec" onPress={() => goToReports("verified")}  />
            <DashboardCard icon={<XCircle color="#991B1B" size={13} />}    label="Rejected Reports"       value={rejected} color="#FEE2E2" onPress={() => goToReports("rejected")}  />
          </View>
        ) : (
          // ── Reports tab: filter chips + report cards ──
          <View style={styles.section}>
            {/* Section title reflects the active filter */}
            <Text style={styles.sectionTitle}>{filterLabel[activeFilter]}</Text>

            {/* Horizontally scrollable filter chips */}
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

            {/* Empty state or report list */}
            {filteredReports.length === 0 ? (
              <Text style={styles.emptyText}>No {filterLabel[activeFilter].toLowerCase()} found.</Text>
            ) : (
              filteredReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  refresh={fetchReports}
                  isRepairTab={activeFilter === "repair"} // controls repair-specific UI
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Tab button (Dashboard / Reports) ─────────────────────────────────────────
function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Dashboard summary card ────────────────────────────────────────────────────
// Tapping navigates to the Reports tab filtered to the relevant category
function DashboardCard({ icon, label, value, color, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <View style={styles.iconBubble}>{icon}</View>
          <Text style={styles.cardLabel}>{label}</Text>
        </View>
        {/* Large number on the right */}
        <Text style={styles.cardValue}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Individual report card (Reports tab) ─────────────────────────────────────
// Handles three admin actions: Verify, Reject, and Close (repair)
function ReportCard({ report, refresh, isRepairTab }: {
  report: Report;
  refresh: () => void;
  isRepairTab: boolean;
}) {
  // Controls which image is shown in the full-screen viewer
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState("");

  // Opens the full-screen image viewer with the given URL
  const openImage = (url: string) => { setViewerImage(url); setViewerVisible(true); };

  // How many reporters are involved, and how many have confirmed the fix
  const totalReporters = report.corroboratedBy.length || 1;
  const fixedVoteCount = report.fixedVotes.filter((uid) =>
    report.corroboratedBy.includes(uid) // only count votes from actual reporters
  ).length;
  // True when every reporter has confirmed the pothole is fixed
  const allConfirmed = fixedVoteCount >= totalReporters;

  // ── Verify action: sets status to "verified" and awards credits ────────────
  const verifyReport = async () => {
    Alert.alert("Verify Report", `Award 50 credits to ${report.corroboratorNames.length} reporter(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Verify",
        onPress: async () => {
          try {
            // Mark the master report as verified
            await updateDoc(doc(db, "reports", report.id), { status: "verified" });

            // Also mark all corroboration sub-documents as verified
            const corrobSnap = await getDocs(
              query(collection(db, "reports"), where("originalReportId", "==", report.id))
            );
            for (const c of corrobSnap.docs) {
              await updateDoc(doc(db, "reports", c.id), { status: "verified" });
            }

            // Award 50 credits to every unique reporter
            const allUserIds = Array.from(new Set(report.corroboratedBy));
            if (allUserIds.length === 0) allUserIds.push(report.userId); // fallback
            let count = 0;
            for (const uid of allUserIds) {
              const userRef = doc(db, "users", uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                // Add 50 to their existing balance
                await updateDoc(userRef, { credits: (userSnap.data()?.credits ?? 0) + 50 });
              } else {
                // Create user doc if it somehow doesn't exist
                await setDoc(userRef, { credits: 50 }, { merge: true });
              }
              count++;
            }

            // Mark credits as awarded on master + all corroboration docs
            await updateDoc(doc(db, "reports", report.id), { creditsAwarded: true });
            for (const c of corrobSnap.docs) {
              await updateDoc(doc(db, "reports", c.id), { creditsAwarded: true });
            }

            Alert.alert(
              "Verified ✅",
              `50 credits awarded to ${count} reporter${count > 1 ? "s" : ""}:\n${report.corroboratorNames.join(", ")}`
            );
            refresh(); // re-fetch so the UI reflects the new status
          } catch (err: any) { Alert.alert("Error", err.message); }
        },
      },
    ]);
  };

  // ── Reject action: sets status to "rejected", no credits awarded ──────────
  const rejectReport = async () => {
    Alert.alert("Reject Report", "Mark as fake/invalid? No credits will be awarded.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "reports", report.id), { status: "rejected" });

            // Propagate rejection to all corroboration sub-documents
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

  // ── Close repair action: marks pothole as officially fixed ─────────────────
  // Removes the pin from the active map by setting repairedClosed = true
  const closeRepairReport = async () => {
    // Message changes based on whether all reporters have confirmed the fix
    const confirmMsg = allConfirmed
      ? `All ${totalReporters} reporter${totalReporters > 1 ? "s have" : " has"} confirmed the pothole at "${report.address}" is fixed.\n\nClose this report? It will be removed from the active map.`
      : `Only ${fixedVoteCount}/${totalReporters} reporter${totalReporters > 1 ? "s have" : " has"} confirmed this is fixed so far.\n\nYou can still close it manually. Close this report?`;

    Alert.alert(
      "Close Report ✅",
      confirmMsg,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Report ✅",
          onPress: async () => {
            try {
              // Mark master report as closed (removes it from the map)
              await updateDoc(doc(db, "reports", report.id), {
                repairedClosed: true,
                repairedClosedAt: new Date().toISOString(),
                repairVerificationPending: false, // clear the pending flag
              });

              // Propagate repairedClosed to all corroboration sub-documents
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
      ]
    );
  };

  // Convenience flags used to drive conditional rendering below
  const isHighPriority = report.corroborationCount >= 2;  // 2+ reporters → red border
  const isPending      = report.status === "pending";
  const isRejected     = report.status === "rejected";
  const allNames       = report.corroboratorNames.length > 0 ? report.corroboratorNames : [report.userName];
  const showRepairAction = report.repairVerificationPending && !report.repairedClosed;

  return (
    <View style={[
      styles.reportCard,
      isHighPriority && isPending  && styles.reportCardHighPriority, // red border for urgent
      isRejected                   && styles.reportCardRejected,     // faded grey for rejected
      isRepairTab && showRepairAction && styles.reportCardRepair,    // amber border for repair tab
    ]}>
      {/* Full-screen image viewer (hidden until a thumbnail is tapped) */}
      <ImageViewerModal visible={viewerVisible} imageUrl={viewerImage} onClose={() => setViewerVisible(false)} />

      {/* Main report thumbnail — tapping opens the full-screen viewer */}
      {report.imageUrl ? (
        <TouchableOpacity onPress={() => openImage(report.imageUrl)} activeOpacity={0.85}>
          <Image source={{ uri: report.imageUrl }} style={styles.reportImage} />
          {/* Small zoom hint overlay on the thumbnail */}
          <View style={styles.zoomHint}><Text style={styles.zoomHintText}>🔍</Text></View>
        </TouchableOpacity>
      ) : null}

      {/* ── Card body ── */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.address} numberOfLines={2}>{report.address}</Text>

        {/* All reporter names with count */}
        <View style={styles.reportersBox}>
          <Text style={styles.reportersLabel}>Reported by ({allNames.length}):</Text>
          {allNames.map((name, i) => (
            <Text key={i} style={styles.reporterName}>👤 {name}</Text>
          ))}
        </View>

        {/* Status badge — green for verified, red for rejected */}
        <Text style={[
          styles.statusText,
          report.status === "verified" && styles.statusVerified,
          report.status === "rejected" && styles.statusRejected,
        ]}>
          Status: {report.status.toUpperCase()}
        </Text>

        {/* High-priority badge shown for multi-user reports */}
        {isHighPriority && (
          <View style={styles.corrobBadge}>
            <Text style={styles.corrobText}>👥 {report.corroborationCount} users reported this</Text>
          </View>
        )}

        {/* ── Repair confirmation details (only shown in Repair tab) ── */}
        {isRepairTab && showRepairAction && (
          <View style={[styles.repairBadge, allConfirmed && styles.repairBadgeReady]}>
            <Text style={[styles.repairBadgeText, allConfirmed && styles.repairBadgeTextReady]}>
              {allConfirmed
                ? `✅ All ${totalReporters} reporter${totalReporters > 1 ? "s" : ""} confirmed it's fixed!`
                : `🔧 ${fixedVoteCount}/${totalReporters} reporter${totalReporters > 1 ? "s" : ""} confirmed it's fixed`}
            </Text>

            {/* Progress bar showing fix confirmation ratio (multi-user only) */}
            {totalReporters > 1 && (
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${(fixedVoteCount / totalReporters) * 100}%` as any,
                      backgroundColor: allConfirmed ? "#16A34A" : "#D97706", // green vs amber
                    },
                  ]}
                />
              </View>
            )}

            {/* Per-reporter confirmation list (multi-user only) */}
            {totalReporters > 1 && (
              <View style={{ marginTop: 6 }}>
                {report.corroboratedBy.map((uid, i) => {
                  const hasConfirmed = report.fixedVotes.includes(uid);
                  const name = report.corroboratorNames[i] || "Unknown";
                  return (
                    <Text
                      key={uid}
                      style={[styles.voterRow, hasConfirmed ? styles.voterConfirmed : styles.voterPending]}
                    >
                      {hasConfirmed ? "✅" : "🕐"} {name}
                    </Text>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* "Officially Closed" badge (shown on closed reports) */}
        {report.repairedClosed && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedBadgeText}>✅ Officially Closed — Removed from map</Text>
          </View>
        )}

        {/* Corroborator thumbnail strip (horizontally scrollable) */}
        {report.corroboratorImages?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {report.corroboratorImages.map((imgUrl, i) => (
              <TouchableOpacity key={i} onPress={() => openImage(imgUrl)} activeOpacity={0.8}>
                <Image source={{ uri: imgUrl }} style={styles.corrobThumb} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Credit status line at the bottom of the card body */}
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

      {/* ── Action buttons column (right side of card) ── */}
      <View style={styles.actionButtons}>
        {/* Verify (✓) and Reject (✗) — only for pending reports */}
        {isPending && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
              onPress={verifyReport}
            >
              <CheckCircle color="white" size={20} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#EF4444", marginTop: 8 }]}
              onPress={rejectReport}
            >
              <XCircle color="white" size={20} />
            </TouchableOpacity>
          </>
        )}

        {/* Close repair button — only in Repair tab, grey until all reporters confirmed */}
        {isRepairTab && showRepairAction && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: allConfirmed ? "#16A34A" : "#94A3B8", // green when ready
                marginTop: isPending ? 8 : 0,
              },
            ]}
            onPress={closeRepairReport}
            activeOpacity={0.8}
          >
            <CheckCircle color="white" size={20} />
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
  card: {
    padding: 15, borderRadius: 18, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
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
  reportCardHighPriority: { borderWidth: 1.5, borderColor: "#FCA5A5", backgroundColor: "#FFF7F7" }, // red-tinted for urgent
  reportCardRejected: { borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", opacity: 0.7 },
  reportCardRepair: { borderWidth: 1.5, borderColor: "#FCD34D", backgroundColor: "#FFFBEB" },      // amber for repair
  reportImage: { width: 80, height: 80, borderRadius: 12 },
  zoomHint: { position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  zoomHintText: { fontSize: 11 },
  address: { fontWeight: "700", fontSize: 13 },
  reportersBox: { marginTop: 4, marginBottom: 2 },
  reportersLabel: { fontSize: 11, color: "#6b7280", fontWeight: "600", marginBottom: 2 },
  reporterName: { fontSize: 12, color: "#111827", fontWeight: "500", marginTop: 2 },
  statusText: { marginTop: 4, color: "#555", fontSize: 12, fontWeight: "600" },
  statusVerified: { color: "#16A34A" },
  statusRejected: { color: "#DC2626" },
  corrobBadge: { marginTop: 6, backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  corrobText: { fontSize: 11, fontWeight: "700", color: "#DC2626" },
  repairBadge: {
    marginTop: 6, backgroundColor: "#FEF3C7", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: "#FCD34D",
  },
  repairBadgeReady: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" }, // turns green when all confirmed
  repairBadgeText: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  repairBadgeTextReady: { color: "#15803D" },
  progressBarContainer: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 999, marginTop: 6, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 999 },
  voterRow: { fontSize: 11, fontWeight: "600", marginTop: 3 },
  voterConfirmed: { color: "#16A34A" },
  voterPending: { color: "#92400E" },
  closedBadge: { marginTop: 6, backgroundColor: "#DCFCE7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  closedBadgeText: { fontSize: 11, fontWeight: "700", color: "#15803D" },
  corrobThumb: { width: 40, height: 40, borderRadius: 6, marginRight: 6, borderWidth: 1, borderColor: "#E5E7EB" },
  creditBadge: { marginTop: 6, fontSize: 11, fontWeight: "600" },
  creditAwarded: { color: "#059669" },
  creditYes: { color: "#D97706" },      // pending colour
  creditRejected: { color: "#9CA3AF" },
  actionButtons: { flexDirection: "column", alignItems: "center", marginLeft: 10 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  closeBtn: { position: "absolute", top: 60, right: 20, zIndex: 10 },
  fullImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});
