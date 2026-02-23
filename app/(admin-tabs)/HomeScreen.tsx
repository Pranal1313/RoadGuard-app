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
} from 'react-native';
import {
  Menu,
  Bell,
  MapPin,
  TrendingUp,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import StatsCard from '../components/StatsCard';
import MapPreview from '../components/MapPreview';

type Report = {
  id: string;
  imageUrl: string;
  location: string;
  status: string;
};

export default function AdminHomeScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const reportsRef = collection(db, 'reports');
        const q = query(reportsRef, orderBy('createdAt', 'desc'), limit(2));
        const snapshot = await getDocs(q);

        const loaded: Report[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            imageUrl: data.imageUrl || '',
            location: data.location || data.address || 'Unknown Location',
            status: data.status || 'pending',
          };
        });

        setReports(loaded);
      } catch (err) {
        console.error('Failed to fetch reports', err);
      }
    };

    fetchReports();
  }, []);

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.row}>
              <Menu color="white" size={24} />
              <Text style={styles.title}>RoadGuard Admin</Text>
            </View>
            <Bell color="white" size={22} />
          </View>

          {/* Info Card — replaced credits with manage reports text */}
          <View style={styles.creditsCard}>
            <Text style={styles.manageTitle}>Welcome, Admin 👋</Text>
            <View style={styles.divider} />
            <Text style={styles.redeemText}>Manage reports efficiently</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatsCard
            icon={<MapPin color="#2563EB" size={20} />}
            label="Total Reports"
            value={reports.length}
          />
          <StatsCard
            icon={<TrendingUp color="#16A34A" size={20} />}
            label="Verified"
            value={reports.filter((r) => r.status === 'verified').length}
          />
        </View>

        {/* Manage Reports Button */}
        <Pressable
          style={styles.reportButton}
          onPress={() => router.push('/AdminScreen')}
        >
          <Text style={styles.reportText}>Manage Reports</Text>
        </Pressable>

        {/* Map */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Potholes</Text>
            <Text style={styles.link}>View All</Text>
          </View>
          <MapPreview />
        </View>

        {/* Recent Reports */}
        <View style={[styles.section, { marginBottom: 30 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
          </View>

          {reports.length === 0 ? (
            <Text style={{ color: '#6B7280', fontStyle: 'italic' }}>
              No reports submitted yet.
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
    backgroundColor: '#78c6a0',
    paddingHorizontal: 19,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 23,
    paddingBottom: 28,
    borderRadius: 22,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '600' },

  creditsCard: {
    backgroundColor: 'rgb(101, 179, 141)',
    borderRadius: 20,
    padding: 16,
  },
  // ✅ Replaced credits number with welcome text
  manageTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 12,
  },
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
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