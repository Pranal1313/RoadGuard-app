import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';

const DATA = [
  { id: 1, location: 'Main Street & 5th Ave', status: 'High' },
  { id: 2, location: 'Elm Road near Park', status: 'Medium' },
  { id: 3, location: 'Highway 21 Exit', status: 'Low' },
];

export default function RecentReports() {
  return (
    <View style={styles.container}>
      {DATA.map(item => (
        <View key={item.id} style={styles.card}>
          <MapPin size={18} color="#2563EB" />
          <View style={styles.text}>
            <Text style={styles.location}>{item.location}</Text>
            <Text style={styles.status}>{item.status} severity</Text>
          </View>
          <View
            style={[
              styles.dot,
              item.status === 'High'
                ? styles.high
                : item.status === 'Medium'
                ? styles.med
                : styles.low,
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  text: {
    flex: 1,
    marginLeft: 10,
  },

  location: {
    fontSize: 14,
    fontWeight: '600',
  },

  status: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  high: { backgroundColor: '#EF4444' },
  med: { backgroundColor: '#F97316' },
  low: { backgroundColor: '#FACC15' },
});
