import { View, StyleSheet } from 'react-native';

export default function MapPreview() {
  return (
    <View style={styles.map}>
      {/* Red - High */}
      <View style={[styles.pin, styles.high, { top: 30, left: 40 }]} />
      <View style={[styles.pin, styles.high, { top: 60, right: 50 }]} />

      {/* Orange - Medium */}
      <View style={[styles.pin, styles.med, { bottom: 40, left: 90 }]} />

      {/* Yellow - Low */}
      <View style={[styles.pin, styles.low, { bottom: 70, right: 100 }]} />

      {/* Zoom Buttons */}
      <View style={styles.zoom}>
        <View style={styles.zoomBtn} />
        <View style={styles.zoomBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 180,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
  },

  pin: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  high: { backgroundColor: '#EF4444' },
  med: { backgroundColor: '#F97316' },
  low: { backgroundColor: '#FACC15' },

  zoom: {
    position: 'absolute',
    right: 10,
    top: 10,
    gap: 6,
  },

  zoomBtn: {
    width: 28,
    height: 28,
    backgroundColor: 'white',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
