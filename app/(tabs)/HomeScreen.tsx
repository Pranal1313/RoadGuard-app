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
  Menu,
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
  const [credits, setCredits] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [mapRefreshKey, setMapRefreshKey] = useState(0); // ✅ forces map refetch when incremented

  const loadData = () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) return;

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          setCredits(userSnap.data()?.credits || 0);
        }
      } catch (err) {
        console.error('Failed to load credits', err);
      }

      try {
        const q = query(
          collection(db, 'reports'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const loaded: Report[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            imageUrl: data.imageUrl || '',
            location: data.location || data.address || 'Unknown Location',
            status: data.status || 'pending',
            createdAt: data.createdAt?.toMillis?.() ?? 0,
            repairedClosed: data.repairedClosed ?? false,
          };
        });

        const sorted = loaded
          .filter((r) => !r.repairedClosed)
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
          .slice(0, 2);

        setReports(sorted);

        // ✅ Increment to tell MapPreview to refetch right now
        setMapRefreshKey((prev) => prev + 1);
      } catch (err) {
        console.error('Failed to fetch reports', err);
      }
    });
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.row}>
              <Menu color="white" size={24} />
              <Text style={styles.title}>RoadGuard</Text>
            </View>
            <Bell color="white" size={22} />
          </View>

          <View style={styles.creditsCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.subText}>Your Credits</Text>
                <Text style={styles.credits}>
                  {credits} <Text style={styles.points}>points</Text>
                </Text>
              </View>
              <View style={styles.iconBubble}>
                <Award color="white" size={28} />
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.redeemText}>Redeemable for highway tolls</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatsCard
            icon={<MapPin color="#2563EB" size={20} />}
            label="My Reports"
            value={reports.length}
          />
          <StatsCard
            icon={<TrendingUp color="#16A34A" size={20} />}
            label="Verified"
            value={reports.filter((r) => r.status === 'verified').length}
          />
        </View>

        {/* Report Button */}
        <Pressable
          style={styles.reportButton}
          onPress={() => router.push('/ReportScreen')}
        >
          <Camera color="black" size={22} />
          <Text style={styles.reportText}>Report a Pothole</Text>
        </Pressable>

        {/* Map */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Potholes</Text>
            <Text style={styles.link}>View All</Text>
          </View>
          <MapPreview refreshKey={mapRefreshKey} />
        </View>

        {/* Recent Reports */}
        <View style={[styles.section, { marginBottom: 30 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Recent Reports</Text>
          </View>

          {reports.length === 0 ? (
            <Text style={{ color: '#6B7280', fontStyle: 'italic' }}>
              You have not submitted any reports yet.
            </Text>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                {report.imageUrl && (
                  <Image
                    source={{ uri: report.imageUrl }}
                    style={styles.reportImage}
                  />
                )}
                <View style={{ flex: 1, marginLeft: report.imageUrl ? 12 : 0 }}>
                  <Text style={styles.reportLocation}>{report.location}</Text>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 23,
    paddingBottom: 28,
    borderRadius: 22,
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
