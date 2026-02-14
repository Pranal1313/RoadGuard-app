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
  Settings,
  Award,
  CreditCard,
  Edit,
  LogOut,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

import { auth, db } from '../../firebaseConfig';

/* ------------ Types ------------ */
type Report = {
  id: string;
  imageUrl: string;
  description?: string;
  severity?: string;
  status: string;
  location?: string;
};

/* ------------ UserProfile Screen ------------ */
export default function UserProfile() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [credits, setCredits] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);

  /* ---------- LOAD USER DATA ---------- */
  useEffect(() => {
    const loadUserData = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.replace('/login');
        return;
      }

      setEmail(user.email || '');

      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFullName(data.fullName || 'User');
          setCredits(data.credits || 0 );
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to load profile data');
      }

      // Fetch user reports
      try {
        const reportsQuery = query(
          collection(db, 'reports'),
          where('userId', '==', user.uid)
        );
        const reportsSnap = await getDocs(reportsQuery);
        const loadedReports: Report[] = reportsSnap.docs.map((docSnap) => {
          const d = docSnap.data() as any;
          return {
            id: docSnap.id,
            imageUrl: d.imageUrl || '',
            description: d.description || '',
            severity: d.severity || '',
            status: d.status || 'pending',
            location: d.location || 'Unknown location',
          };
        });
        setReports(loadedReports);
      } catch (err) {
        Alert.alert('Error', 'Failed to load your reports');
        console.error(err);
      }
    };

    loadUserData();
  }, []);

  /* ---------- LOGOUT ---------- */
  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  /* ---------- INITIALS ---------- */
  const initials = fullName
    ? fullName
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft color="white" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <Settings color="white" size={22} />
          </View>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View>
                <Text style={styles.name}>{fullName}</Text>
                <Text style={styles.email}>{email}</Text>
              </View>
            </View>

            {/* Credits */}
            <View style={styles.creditsBox}>
              <View style={styles.creditsHeader}>
                <Text style={styles.creditsLabel}>Total Credits Earned</Text>
                <View style={styles.awardIcon}>
                  <Award size={18} color="white" />
                </View>
              </View>

              <View style={styles.creditsRow}>
                <Text style={styles.creditsValue}>{credits}</Text>
                <Text style={styles.points}>points</Text>
              </View>

              <TouchableOpacity style={styles.redeemBtn}>
                <CreditCard size={18} color="white" />
                <Text style={styles.redeemText}>Redeem Credits</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* My Reports */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Reports</Text>
          </View>

          {reports.length === 0 ? (
            <Text style={{ color: '#6B7280', fontStyle: 'italic' }}>You have not submitted any reports yet.</Text>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                {report.imageUrl ? (
                  <Image source={{ uri: report.imageUrl }} style={styles.reportImage} />
                ) : null}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.address}>{report.location}</Text>
                  {report.severity && <Text style={styles.name}>Severity: {report.severity}</Text>}
                  <Text style={styles.statusText}>Status: {report.status.toUpperCase()}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsBox}>
          <ActionItem icon={<Edit size={20} color="#2563EB" />} label="Edit Profile" />
          <ActionItem
            icon={<LogOut size={20} color="#DC2626" />}
            label="Logout"
            danger
            onPress={handleLogout}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>RoadGuard v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- Action Item ---------- */
function ActionItem({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionItem} onPress={onPress}>
      {icon}
      <Text style={[styles.actionText, danger && { color: '#DC2626' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- Styles (UNCHANGED) ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },

  header: {
    backgroundColor: '#042262',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 24,
    paddingBottom: 60,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },

  profileCard: {
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 16,
    marginTop: 24,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1077a3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  email: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  creditsBox: {
    marginTop: 18,
    backgroundColor: '#fff6ce',
    borderRadius: 16,
    padding: 16,
  },

  creditsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  creditsLabel: {
    fontSize: 12,
    color: '#92400E',
  },

  awardIcon: {
    backgroundColor: '#F59E0B',
    padding: 8,
    borderRadius: 999,
  },

  creditsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 6,
    marginBottom: 14,
  },

  creditsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#92400E',
  },

  points: {
    fontSize: 13,
    color: '#92400E',
    marginBottom: 2,
  },

  redeemBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  redeemText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  actionsBox: {
    backgroundColor: 'white',
    borderRadius: 18,
    marginHorizontal: 20,
    marginTop: 24,
  },

  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },

  footer: {
    alignItems: 'center',
    marginVertical: 24,
  },

  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  reportCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportImage: { width: 80, height: 80, borderRadius: 12 },
  address: { fontWeight: '700' },
  statusText: { marginTop: 2, color: '#555', fontSize: 12 },
});
