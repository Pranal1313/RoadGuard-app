import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar, Platform } from 'react-native';
import { Menu, Bell, Camera, Award, MapPin, TrendingUp } from 'lucide-react-native';
import StatsCard from '../components/StatsCard';
import MapPreview from '../components/MapPreview';
import RecentReports from '../components/RecentReports';

export default function HomeScreen() {
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

          {/* Credits Card */}
          <View style={styles.creditsCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.subText}>Your Credits</Text>
                <Text style={styles.credits}>
                  1250 <Text style={styles.points}>points</Text>
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
            label="Total Reports"
            value={23}
          />
          <StatsCard
            icon={<TrendingUp color="#16A34A" size={20} />}
            label="Verified"
            value={18}
          />
        </View>

        {/* Report Button */}
        <Pressable style={styles.reportButton}>
          <Camera color="black" size={22} />
          <Text style={styles.reportText}>Report a Pothole</Text>
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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
            <Text style={styles.link}>See All</Text>
          </View>
          <RecentReports />
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  header: {
    backgroundColor: '#042262',
    paddingHorizontal: 19,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 23, // <-- Notch/status bar safe
    paddingBottom: 28,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },

  creditsCard: {
    backgroundColor: 'rgba(133, 125, 125, 0.15)',
    borderRadius: 20,
    padding: 16,
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  subText: {
    color: '#DBEAFE',
    fontSize: 13,
  },

  credits: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },

  points: {
    fontSize: 14,
    fontWeight: '400',
  },

  iconBubble: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    padding: 12,
    borderRadius: 999,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 12,
  },

  redeemText: {
    color: '#DBEAFE',
    fontSize: 13,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },

  reportButton: {
    flexDirection: 'row',
    backgroundColor: '#a8bff1',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  reportText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '600',
  },

  section: {
    paddingHorizontal: 20,
    marginTop: 20,
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
});
