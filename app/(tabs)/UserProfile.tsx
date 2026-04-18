
// Shows the logged-in user's profile info, credit balance,
// full report history (with credit status per report), and a logout button.
// Data is re-fetched every time the screen gains focus.


import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import {
  ChevronLeft,
  Award,
  CreditCard,
  LogOut,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

// Shape of a single pothole report from Firestore
type Report = {
  id: string;
  imageUrl: string;
  description?: string;
  severity?: string;
  status: string;
  location?: string;
  creditEligible?: boolean;   // true if this report is eligible for credits
  creditsAwarded?: boolean;   // true if credits have already been given
};

export default function UserProfile() {
  const router = useRouter();

  // User identity fields loaded from Firestore
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [credits, setCredits] = useState(0);

  // All reports submitted by this user
  const [reports, setReports] = useState<Report[]>([]);

  // ── Load profile data and reports from Firestore ───────────────────────────
  const loadUserData = async () => {
    const user = auth.currentUser;

    // If not logged in, redirect to login screen
    if (!user) {
      router.replace('/login');
      return;
    }

    // Set email directly from the Firebase Auth object (always available)
    setEmail(user.email || '');

    // ── Fetch extra user data from Firestore (name, credits, role) ──────────
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFullName(data.fullName || 'User');
        setCredits(data.credits || 0);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile data');
    }

    // ── Fetch all reports submitted by this user ─────────────────────────────
    try {
      const reportsQuery = query(
        collection(db, 'reports'),
        where('userId', '==', user.uid) // filter to only this user's reports
      );
      const reportsSnap = await getDocs(reportsQuery);

      // Map each Firestore document to our Report type
      const loadedReports: Report[] = reportsSnap.docs.map((docSnap) => {
        const d = docSnap.data() as any;
        return {
          id: docSnap.id,
          imageUrl: d.imageUrl || '',
          description: d.description || '',
          severity: d.severity || '',
          status: d.status || 'pending',
          location: d.location || d.address || 'Unknown location',
          creditEligible: d.creditEligible ?? false,
          creditsAwarded: d.creditsAwarded ?? false,
        };
      });

      setReports(loadedReports);
    } catch (err) {
      Alert.alert('Error', 'Failed to load your reports');
      console.error(err);
    }
  };

  // Re-run every time this screen comes into focus (e.g. after navigating back)
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  // ── Sign out and navigate to login ─────────────────────────────────────────
  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  // Build 1–2 character initials from fullName for the avatar circle
  // e.g. "John Doe" → "JD", "Alice" → "A"
  const initials = fullName
    ? fullName.split(' ').map((word) => word[0]).join('').toUpperCase()
    : 'U'; // fallback

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Dark blue header: back button, title ── */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft color="white" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            {/* Spacer keeps title centred */}
            <View style={{ width: 24 }} />
          </View>

          {/* ── White profile card inside header ── */}
          <View style={styles.profileCard}>
            {/* Avatar circle + name/email */}
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View>
                <Text style={styles.name}>{fullName}</Text>
                <Text style={styles.email}>{email}</Text>
              </View>
            </View>

            {/* ── Credits box: balance + redeem button ── */}
            <View style={styles.creditsBox}>
              <View style={styles.creditsHeader}>
                <Text style={styles.creditsLabel}>Total Credits Earned</Text>
                {/* Gold award icon */}
                <View style={styles.awardIcon}>
                  <Award size={18} color="white" />
                </View>
              </View>

              {/* Large credit number */}
              <View style={styles.creditsRow}>
                <Text style={styles.creditsValue}>{credits}</Text>
                <Text style={styles.points}>points</Text>
              </View>

              {/* Redeem button (currently no navigation — can be wired up later) */}
              <TouchableOpacity style={styles.redeemBtn}>
                <CreditCard size={18} color="white" />
                <Text style={styles.redeemText}>Redeem Credits</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── My Reports section ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Reports</Text>
          </View>

          {reports.length === 0 ? (
            // Empty state
            <Text style={{ color: '#6B7280', fontStyle: 'italic' }}>
              You have not submitted any reports yet.
            </Text>
          ) : (
            // One card per report
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                {/* Thumbnail (only rendered if imageUrl exists) */}
                {report.imageUrl ? (
                  <Image source={{ uri: report.imageUrl }} style={styles.reportImage} />
                ) : null}

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.address} numberOfLines={2}>{report.location}</Text>

                  {/* Severity shown only if available */}
                  {report.severity ? (
                    <Text style={styles.severityText}>Severity: {report.severity}</Text>
                  ) : null}

                  {/* Status in uppercase */}
                  <Text style={styles.statusText}>
                    Status: {report.status.toUpperCase()}
                  </Text>

                  {/* Credit badge: green = awarded, amber = pending, grey = ineligible */}
                  <Text style={[
                    styles.creditBadge,
                    report.creditsAwarded
                      ? styles.creditAwarded    // credits already given ✓
                      : report.creditEligible
                      ? styles.creditPending    // eligible but not yet awarded ⏳
                      : styles.creditNone       // not eligible ✗
                  ]}>
                    {report.creditsAwarded
                      ? "✓ +50 Credits Awarded"
                      : report.creditEligible
                      ? "⏳ 50 Credits Pending Verification"
                      : "✗ No Credits (limit reached)"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Actions section: only Logout for now ── */}
        <View style={styles.actionsBox}>
          <ActionItem
            icon={<LogOut size={20} color="#DC2626" />}
            label="Logout"
            danger
            onPress={handleLogout}
          />
        </View>

        {/* App version footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>RoadGuard v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Reusable action row item ───────────────────────────────────────────────────
// Used for the Logout button (and any future actions like "Edit Profile")
function ActionItem({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;    // renders label in red when true
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionItem} onPress={onPress}>
      {icon}
      <Text style={[styles.actionText, danger && { color: '#DC2626' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },
  header: {
    backgroundColor: '#042262',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 24,
    paddingBottom: 50,
    paddingHorizontal: 20,
    borderRadius: 26,
    marginHorizontal: 3,
    marginTop: 4,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '600' },
  profileCard: { backgroundColor: 'white', borderRadius: 22, padding: 16, marginTop: 24 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1077a3', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 16, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600', color: '#111827' },
  email: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  creditsBox: { marginTop: 18, backgroundColor: '#fff6ce', borderRadius: 16, padding: 16 },
  creditsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  creditsLabel: { fontSize: 12, color: '#92400E' },
  awardIcon: { backgroundColor: '#F59E0B', padding: 8, borderRadius: 999 },
  creditsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 6, marginBottom: 14 },
  creditsValue: { fontSize: 24, fontWeight: '700', color: '#92400E' },
  points: { fontSize: 13, color: '#92400E', marginBottom: 2 },
  redeemBtn: { backgroundColor: '#F59E0B', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  redeemText: { color: 'white', fontSize: 14, fontWeight: '600' },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  actionsBox: { backgroundColor: 'white', borderRadius: 18, marginHorizontal: 20, marginTop: 24 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  actionText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  footer: { alignItems: 'center', marginVertical: 24 },
  footerText: { fontSize: 12, color: '#9CA3AF' },
  reportCard: { backgroundColor: 'white', padding: 16, borderRadius: 18, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-start' },
  reportImage: { width: 80, height: 80, borderRadius: 12 },
  address: { fontWeight: '700', fontSize: 13 },
  severityText: { color: '#6b7280', marginTop: 2, fontSize: 12 },
  statusText: { marginTop: 2, color: '#555', fontSize: 12 },
  creditBadge: { marginTop: 4, fontSize: 11, fontWeight: '600' },
  creditAwarded: { color: '#059669' },
  creditPending: { color: '#D97706' },
  creditNone: { color: '#9CA3AF' },
});
