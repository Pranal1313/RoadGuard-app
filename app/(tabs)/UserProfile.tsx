import React from 'react';
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
  ChevronLeft,
  Settings,
  Award,
  CreditCard,
  Edit,
  LogOut,
} from 'lucide-react-native';

import RecentReports from '../components/RecentReports';

export default function UserProfile() {
  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <ChevronLeft color="white" size={24} />
            <Text style={styles.headerTitle}>Profile</Text>
            <Settings color="white" size={22} />
          </View>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            {/* User Info */}
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>JD</Text>
              </View>

              <View>
                <Text style={styles.name}>John Doe</Text>
                <Text style={styles.email}>john.doe@example.com</Text>
              </View>
            </View>

            {/* Credits */}
            <View style={styles.creditsBox}>
              <View style={styles.creditsHeader}>
                <Text style={styles.creditsLabel}>
                  Total Credits Earned
                </Text>

                {/* Award icon */}
                <View style={styles.awardIcon}>
                  <Award size={18} color="white" />
                </View>
              </View>

              <View style={styles.creditsRow}>
                <Text style={styles.creditsValue}>1250</Text>
                <Text style={styles.points}>points</Text>
              </View>

              {/* Redeem button */}
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
            <Text style={styles.link}>See All</Text>
          </View>

          <RecentReports />
        </View>

        {/* Actions */}
        <View style={styles.actionsBox}>
          <ActionItem
            icon={<Edit size={20} color="#2563EB" />}
            label="Edit Profile"
          />
          <ActionItem
            icon={<LogOut size={20} color="#DC2626" />}
            label="Logout"
            danger
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>RoadGuard v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------------- Action Item ---------------- */

function ActionItem({
  icon,
  label,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.actionItem}>
      {icon}
      <Text
        style={[
          styles.actionText,
          danger && { color: '#DC2626' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  header: {
    backgroundColor: '#042262',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 24,
    paddingBottom: 70,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
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
    backgroundColor: '#FFFBEB',
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

  link: {
    color: '#2563EB',
    fontSize: 13,
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
});
