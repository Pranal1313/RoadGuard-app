
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import {

  Bell,
  Camera,
  Award,
  MapPin,
  TrendingUp,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import StatsCard from '../components/StatsCard';
import MapPreview from '../components/MapPreview';

// structure of a pothole report document from Firestore
type Report = {
  id: string;
  imageUrl: string;
  location: string;
  status: string;
  createdAt?: number;
  repairedClosed?: boolean;
};

export default function HomeScreen() {
  const router = useRouter();

  // Holds the user's credit balance from Firestore
  const [credits, setCredits] = useState(0);

  // Holds the user's 2 most recent non-closed reports
  const [reports, setReports] = useState<Report[]>([]);

  // Incrementing this key forces MapPreview to re-fetch data
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  // Called every time this screen comes into focus (e.g. navigating back)
  const loadData = () => {
    // Listen for auth state; unsubscribe immediately after first event
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // prevent memory leaks — only need one auth check
      if (!user) return; // not logged in, do nothing

      // ── Fetch user's credit balance ──────────────────────────────
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          setCredits(userSnap.data()?.credits || 0);
        }
      } catch (err) {
        console.error('Failed to load credits', err);
      }

      // ── Fetch reports submitted by this user ─────────────────────
      try {
        const q = query(
          collection(db, 'reports'),
          where('userId', '==', user.uid) // only this user's reports
        );
        const snapshot = await getDocs(q);

        // Map each Firestore doc to our Report type
        const loaded: Report[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            imageUrl: data.imageUrl || '',
            location: data.location || data.address || 'Unknown Location',
            status: data.status || 'pending',
            createdAt: data.createdAt?.toMillis?.() ?? 0, // Firestore Timestamp → ms
            repairedClosed: data.repairedClosed ?? false,
          };
        });

        // Filter out repaired/closed reports, sort newest first, keep top 2
        const sorted = loaded
          .filter((r) => !r.repairedClosed)
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
          .slice(0, 2);

        setReports(sorted);

        // Bump the key so MapPreview re-fetches its markers
        setMapRefreshKey((prev) => prev + 1);
      } catch (err) {
        console.error('Failed to fetch reports', err);
      }
    });
  };

  // Re-run loadData every time this tab/screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Top header: app title, bell icon, credits card ── */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.row}>
          
              <Text style={styles.title}>RoadGuard</Text>
            </View>
            <Bell color="white" size={22} />
          </View>

          {/* Credits card inside the header */}
          <View style={styles.creditsCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.subText}>Your Credits</Text>
                {/* Shows numeric credits with smaller "points" label */}
                <Text style={styles.credits}>
                  {credits} <Text style={styles.points}>points</Text>
                </Text>
              </View>
              {/* Award icon in a circular bubble */}
              <View style={styles.iconBubble}>
                <Award color="white" size={28} />
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.redeemText}>Redeemable for highway tolls</Text>
          </View>
        </View>

        {/* ── Stats row: total reports & verified count ── */}
        <View style={styles.statsRow}>
          <StatsCard
            icon={<MapPin color="#2563EB" size={20} />}
            label="My Reports"
            value={reports.length}  // total non-closed reports
          />
          <StatsCard
            icon={<TrendingUp color="#16A34A" size={20} />}
            label="Verified"
            value={reports.filter((r) => r.status === 'verified').length} // verified subset
          />
        </View>

        {/* ── Big action button → navigates to ReportScreen ── */}
        <Pressable
          style={styles.reportButton}
          onPress={() => router.push('/ReportScreen')}
        >
          <Camera color="black" size={22} />
          <Text style={styles.reportText}>Report a Pothole</Text>
        </Pressable>

        {/* ── Map section showing nearby pothole pins ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Potholes</Text>
            <Text style={styles.link}>View All</Text>
          </View>
          {/* refreshKey prop tells MapPreview to re-fetch when reports change */}
          <MapPreview refreshKey={mapRefreshKey} />
        </View>

        {/* ── Recent reports list (max 2 cards) ── */}
        <View style={[styles.section, { marginBottom: 30 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Recent Reports</Text>
          </View>

          {reports.length === 0 ? (
            // Empty state message
            <Text style={{ color: '#6B7280', fontStyle: 'italic' }}>
              You have not submitted any reports yet.
            </Text>
          ) : (
            // Render a card for each recent report
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                {/* Show thumbnail only if imageUrl exists */}
                {report.imageUrl && (
                  <Image
                    source={{ uri: report.imageUrl }}
                    style={styles.reportImage}
                  />
                )}
                <View style={{ flex: 1, marginLeft: report.imageUrl ? 12 : 0 }}>
                  <Text style={styles.reportLocation}>{report.location}</Text>
                  {/* Status shown in uppercase (e.g. PENDING, VERIFIED) */}
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
    backgroundColor: '#042262',
    paddingHorizontal: 19,
    // Extra top padding on Android to account for the status bar height
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 23,
    paddingBottom: 28,
    borderRadius: 22,
    marginHorizontal: 3,
    marginTop: 6,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: 'white', fontSize: 20, fontWeight: '600' },
  creditsCard: { backgroundColor: 'rgba(133,125,125,0.15)', borderRadius: 20, padding: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  subText: { color: '#DBEAFE', fontSize: 13 },
  credits: { color: 'white', fontSize: 28, fontWeight: '700' },
  points: { fontSize: 14, fontWeight: '400' },
  iconBubble: { backgroundColor: 'rgba(255,255,255,0.25)', padding: 12, borderRadius: 999 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 12 },
  redeemText: { color: '#DBEAFE', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12, padding: 20 },
  reportButton: { flexDirection: 'row', backgroundColor: '#a8bff1', marginHorizontal: 20, padding: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 10 },
  reportText: { color: 'black', fontSize: 16, fontWeight: '600' },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  link: { color: '#2563EB', fontSize: 13 },
  reportCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12 },
  reportImage: { width: 60, height: 60, borderRadius: 8 },
  reportLocation: { fontWeight: '600', fontSize: 14 },
  reportStatus: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
