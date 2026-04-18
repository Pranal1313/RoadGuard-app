
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Platform,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  MapPin,
  TrendingUp,
  LogOut,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { collection, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import StatsCard from '../components/StatsCard';
import MapPreview from '../components/MapPreview';

// Shape of each report document read from Firestore
type Report = {
  id: string;
  imageUrl: string;
  location: string;
  status: string;
  createdAt?: number;
  isCorroboration?: boolean;  // true = secondary/duplicate doc, not a master report
  repairedClosed?: boolean;   // true = admin officially closed this pothole
};

export default function AdminHomeScreen() {
  const router = useRouter();

  // All primary (non-corroboration, non-closed) reports — used for stats
  const [reports, setReports] = useState<Report[]>([]);

  // The 2 most recent primary reports — shown in the "Recent Reports" section
  const [recentReports, setRecentReports] = useState<Report[]>([]);

  // ── Fetch all reports from Firestore ──────────────────────────────────────
  const fetchReports = async () => {
    try {
      // Get every document in the reports collection (no server-side filter)
      const allSnap = await getDocs(collection(db, 'reports'));

      const allLoaded: Report[] = allSnap.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          imageUrl: data.imageUrl || '',
          location: data.location || data.address || 'Unknown Location',
          status: data.status || 'pending',
          createdAt: data.createdAt?.toMillis?.() ?? 0, // Firestore Timestamp → ms
          isCorroboration: data.isCorroboration ?? false,
          repairedClosed: data.repairedClosed ?? false,
        };
      });

      // For stats: exclude corroboration sub-docs and officially closed reports
      // so the counts reflect real unique open potholes
      const primaryReports = allLoaded.filter(
        (r) => r.isCorroboration !== true && !r.repairedClosed
      );
      setReports(primaryReports);

      // For "Recent Reports": sort newest first, keep top 2
      const recent = [...primaryReports]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 2);
      setRecentReports(recent);
    } catch (err) {
      console.error('Failed to fetch reports', err);
    }
  };

  // Re-fetch every time this screen gains focus (e.g. returning from ManageReports)
  useFocusEffect(
    React.useCallback(() => {
      fetchReports();
    }, [])
  );

  // ── Logout with confirmation dialog ──────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth);
            router.replace('/login'); // send back to auth screen
          },
        },
      ]
    );
  };

  // Derived stat values used by the two StatsCards
  const totalCount = reports.length;
  const verifiedCount = reports.filter((r) => r.status === 'verified').length;

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Green header: app name + logout button + welcome card ── */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.row}>
              <Text style={styles.title}>RoadGuard Admin</Text>
            </View>

            {/* Logout icon button — triggers confirmation alert */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <LogOut color="white" size={20} />
            </TouchableOpacity>
          </View>

          {/* Welcome card inside the header */}
          <View style={styles.creditsCard}>
            <Text style={styles.manageTitle}>Welcome, Admin 👋</Text>
            <View style={styles.divider} />
            <Text style={styles.redeemText}>Manage reports efficiently</Text>
          </View>
        </View>

        {/* ── Stats row: total reports & verified count ── */}
        <View style={styles.statsRow}>
          <StatsCard
            icon={<MapPin color="#2563EB" size={20} />}
            label="Total Reports"
            value={totalCount}
          />
          <StatsCard
            icon={<TrendingUp color="#16A34A" size={20} />}
            label="Verified"
            value={verifiedCount}
          />
        </View>

        {/* ── Primary action button → navigates to the full ManageReports screen ── */}
        <Pressable
          style={styles.reportButton}
          onPress={() => router.push('/ManageReports')}
        >
          <Text style={styles.reportText}>Manage Reports</Text>
        </Pressable>

        {/* ── Map section: shows all active pothole pins ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Potholes</Text>
          </View>
          {/* No refreshKey needed here — map re-fetches via useFocusEffect */}
          <MapPreview />
        </View>

        {/* ── Recent Reports section (2 newest primary reports) ── */}
        <View style={[styles.section, { marginBottom: 30 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
          </View>

          {recentReports.length === 0 ? (
            // Empty state
            <Text style={{ color: '#6B7280', fontStyle: 'italic' }}>
              No reports submitted yet.
            </Text>
          ) : (
            // One card per recent report
            recentReports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                {/* Show thumbnail only if an image URL exists */}
                {report.imageUrl && (
                  <Image
                    source={{ uri: report.imageUrl }}
                    style={styles.reportImage}
                  />
                )}
                <View style={{ flex: 1, marginLeft: report.imageUrl ? 12 : 0 }}>
                  <Text style={styles.reportLocation}>{report.location}</Text>
                  {/* Status displayed in uppercase (PENDING / VERIFIED / REJECTED) */}
                  <Text style={styles.reportStatus}>
                    Status: {report.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },
  header: {
    backgroundColor: '#449a70',
    paddingHorizontal: 19,
    // Push content below the Android status bar
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 23,
    paddingBottom: 28,
    borderRadius: 22,
    marginHorizontal: 3,
    marginTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    padding: 8,
    borderRadius: 10,
  },
  creditsCard: {
    backgroundColor: 'rgb(101, 179, 141)',
    borderRadius: 20,
    padding: 16,
  },
  manageTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 12 },
  redeemText: { color: '#1a1a1a', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12, padding: 20 },
  reportButton: {
    flexDirection: 'row',
    backgroundColor: '#94dcb9',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  reportText: { color: 'black', fontSize: 16, fontWeight: '600' },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  link: { color: '#113b97', fontSize: 13 },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  reportImage: { width: 60, height: 60, borderRadius: 8 },
  reportLocation: { fontWeight: '600', fontSize: 14 },
  reportStatus: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
