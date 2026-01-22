import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
} from 'react-native';
import {
  User,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';

/* ---------- Types ---------- */

type ReportStatus = 'Pending' | 'Verified' | 'Rejected';

type Report = {
  id: number;
  address: string;
  name: string;
  status: ReportStatus;
};

/* ---------- Mock Data ---------- */

const REPORTS: Report[] = [
  {
    id: 1,
    address: 'Main Street & 5th Avenue',
    name: 'John Doe',
    status: 'Pending',
  },
  {
    id: 2,
    address: 'Elm Street, Block 4',
    name: 'Sarah Khan',
    status: 'Pending',
  },
  {
    id: 3,
    address: 'Market Road',
    name: 'Alex Smith',
    status: 'Verified',
  },
];

/* ---------- Screen ---------- */

export default function AdminDashboardScreen() {
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Reports'>(
    'Dashboard'
  );

  const total = REPORTS.length;
  const pending = REPORTS.filter(r => r.status === 'Pending').length;
  const verified = REPORTS.filter(r => r.status === 'Verified').length;

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>RoadGuard Admin</Text>
              <Text style={styles.subtitle}>Management Dashboard</Text>
            </View>

            {/* Profile Icon */}
            <View style={styles.profile}>
              <User color="white" size={22} />
            </View>
          </View>
        </View>

        {/* PANEL SWITCH */}
        <View style={styles.tabContainer}>
          <TabButton
            label="Dashboard"
            active={activeTab === 'Dashboard'}
            onPress={() => setActiveTab('Dashboard')}
          />
          <TabButton
            label="Reports"
            active={activeTab === 'Reports'}
            onPress={() => setActiveTab('Reports')}
          />
        </View>

        {/* CONTENT */}
        {activeTab === 'Dashboard' ? (
          <>
            {/* DASHBOARD STATS */}
            <View style={styles.section}>
              <DashboardCard
                icon={<MapPin color="#2563EB" size={22} />}
                label="Total Reports"
                value={total}
              />
              <DashboardCard
                icon={<AlertCircle color="#F59E0B" size={22} />}
                label="Pending Reports"
                value={pending}
              />
              <DashboardCard
                icon={<CheckCircle color="#16A34A" size={22} />}
                label="Verified Reports"
                value={verified}
              />
            </View>

            {/* MAP OVERVIEW */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Map Overview</Text>
              <MapOverview />
            </View>
          </>
        ) : (
          <>
            {/* REPORTS PANEL */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Reports</Text>

              {REPORTS.map(r => (
                <ReportCard key={r.id} report={r} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ---------- Components ---------- */

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DashboardCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <View style={styles.iconBubble}>{icon}</View>
          <Text style={styles.cardLabel}>{label}</Text>
        </View>
        <Text style={styles.cardValue}>{value}</Text>
      </View>
    </View>
  );
}

function ReportCard({ report }: { report: Report }) {
  return (
    <View style={styles.reportCard}>
      <View>
        <Text style={styles.address}>{report.address}</Text>
        <Text style={styles.name}>Reported by {report.name}</Text>
      </View>

      <View style={styles.reportActions}>
        <ActionBtn icon={<CheckCircle color="white" size={18} />} bg="#22c55e" />
        <ActionBtn icon={<XCircle color="white" size={18} />} bg="#ef4444" />
      </View>
    </View>
  );
}

function ActionBtn({
  icon,
  bg,
}: {
  icon: React.ReactNode;
  bg: string;
}) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: bg }]}>
      {icon}
    </TouchableOpacity>
  );
}

/* ---------- Map Preview ---------- */

function MapOverview() {
  return (
    <View style={styles.mapBox}>
      <View style={styles.fakeMap}>
        <View style={[styles.pin, { top: 40, left: 60 }]} />
        <View style={[styles.pin, { top: 80, right: 70 }]} />
        <View style={[styles.pin, { bottom: 50, left: 120 }]} />
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  header: {
    backgroundColor: '#035a1a',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 30,
    paddingBottom: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,

  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },

  subtitle: {
    color: '#DBEAFE',
    marginTop: 4,
  },

  profile: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    padding: 12,
    borderRadius: 999,
  },

  /* TABS */
  tabContainer: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
  },

  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },

  tabBtnActive: {
    backgroundColor: '#068608',
  },

  tabText: {
    fontWeight: '600',
    color: '#374151',
  },

  tabTextActive: {
    color: 'white',
  },

  /* SECTION */
  section: {
    paddingHorizontal: 20,
    marginTop: 10,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },

  /* DASHBOARD CARD */
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  iconBubble: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 12,
  },

  cardLabel: {
    fontWeight: '600',
  },

  cardValue: {
    fontSize: 22,
    fontWeight: '800',
  },

  /* REPORTS */
  reportCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  address: {
    fontWeight: '700',
  },

  name: {
    color: '#6b7280',
    marginTop: 4,
  },

  reportActions: {
    flexDirection: 'row',
    gap: 10,
  },

  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* MAP */
  mapBox: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 12,
  },

  fakeMap: {
    height: 180,
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    position: 'relative',
  },

  pin: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: '#EF4444',
    borderRadius: 7,
  },
});
