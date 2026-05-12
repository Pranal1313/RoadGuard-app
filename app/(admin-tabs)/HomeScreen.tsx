import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  StatusBar, Platform, Image, TouchableOpacity, Alert,
} from 'react-native';
import { MapPin, TrendingUp, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { collection, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import StatsCard from '../components/StatsCard';
import MapPreview from '../components/MapPreview';

type Report = {
  id: string;
  imageUrl: string;
  location: string;
  status: string;
  createdAt?: number;
  isCorroboration?: boolean;
  repairedClosed?: boolean;
};

export default function AdminHomeScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);

  const fetchReports = async () => {
    try {
      const allSnap = await getDocs(collection(db, 'reports'));
      const allLoaded: Report[] = allSnap.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          imageUrl: data.imageUrl || '',
          location: data.location || data.address || 'Unknown Location',
          status: data.status || 'pending',
          createdAt: data.createdAt?.toMillis?.() ?? 0,
          isCorroboration: data.isCorroboration ?? false,
          repairedClosed: data.repairedClosed ?? false,
        };
      });

      // FIX: primaryReports includes ALL non-corroboration reports (including closed)
      // so totalCount matches ManageReports
      const primaryReports = allLoaded.filter((r) => r.isCorroboration !== true);
      setReports(primaryReports);

      // Recent feed still shows only active (non-closed) reports
      const activeReports = primaryReports.filter((r) => !r.repairedClosed);
      const recent = [...activeReports]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 2);
      setRecentReports(recent);
    } catch (err) {
      console.error('Failed to fetch reports', err);
    }
  };

  useFocusEffect(React.useCallback(() => { fetchReports(); }, []));

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
            router.replace('/login');
          },
        },
      ]
    );
  };

  const totalCount    = reports.length;                                           // FIX: all reports
  const verifiedCount = reports.filter((r) => r.status === 'verified').length;   // all verified incl. closed

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>RoadGuard Admin</Text>
          </View>
          <View style={styles.creditsCard}>
            <Text style={styles.manageTitle}>Welcome, Admin 👋</Text>
            <View style={styles.divider} />
            <Text style={styles.redeemText}>Manage reports efficiently</Text>
          </View>
        </View>

        {/* Stats — tapping either card goes to ManageReports */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statsTouchable}
            onPress={() => router.push('/ManageReports')}   // FIX: tappable
            activeOpacity={0.8}
          >
            <StatsCard
              icon={<MapPin color="#2563EB" size={20} />}
              label="Total Reports"
              value={totalCount}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statsTouchable}
            onPress={() => router.push('/ManageReports')}   // FIX: tappable
            activeOpacity={0.8}
          >
            <StatsCard
              icon={<TrendingUp color="#16A34A" size={20} />}
              label="Verified"
              value={verifiedCount}
            />
          </TouchableOpacity>
        </View>

        {/* Manage Reports button */}
        <Pressable
          style={styles.reportButton}
          onPress={() => router.push('/ManageReports')}
        >
          <Text style={styles.reportText}>Manage Reports</Text>
        </Pressable>

        {/* Map */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Potholes</Text>
          </View>
          <MapPreview />
        </View>

        {/* Recent Reports */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
          </View>
          {recentReports.length === 0 ? (
            <Text style={{ color: '#6B7280', fontStyle: 'italic' }}>
              No reports submitted yet.
            </Text>
          ) : (
            recentReports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                {report.imageUrl && (
                  <Image source={{ uri: report.imageUrl }} style={styles.reportImage} />
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

        {/* Logout */}
        <View style={styles.actionsBox}>
          <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
            <LogOut size={20} color="#DC2626" />
            <Text style={[styles.actionText, { color: '#DC2626' }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>RoadGuard v1.0.0</Text>
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
  title: { color: '#ffffff', fontSize: 20, fontWeight: '600' },
  creditsCard: { backgroundColor: 'rgb(101, 179, 141)', borderRadius: 20, padding: 16 },
  manageTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 12 },
  redeemText: { color: '#1a1a1a', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12, padding: 20 },
  statsTouchable: { flex: 1 },   // each card takes equal width and is tappable
  reportButton: {
    backgroundColor: '#94dcb9', marginHorizontal: 20, padding: 16,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  reportText: { color: 'black', fontSize: 16, fontWeight: '600' },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  reportCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 12, borderRadius: 12, marginBottom: 12,
  },
  reportImage: { width: 60, height: 60, borderRadius: 8 },
  reportLocation: { fontWeight: '600', fontSize: 14 },
  reportStatus: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  actionsBox: {
    backgroundColor: 'white', borderRadius: 18,
    marginHorizontal: 20, marginTop: 24, marginBottom: 8,
  },
  actionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  actionText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  footer: { alignItems: 'center', marginVertical: 24 },
  footerText: { fontSize: 12, color: '#9CA3AF' },
});
