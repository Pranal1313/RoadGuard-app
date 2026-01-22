import { View, Text, StyleSheet } from 'react-native';

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

export default function StatsCard({ icon, label, value }: StatsCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>{icon}</View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  icon: {
    marginBottom: 8,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});
