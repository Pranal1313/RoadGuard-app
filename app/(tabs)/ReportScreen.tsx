import React, { useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Button,
  Alert,
  ActivityIndicator,
} from 'react-native';

import {
  CameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
} from 'expo-camera';

import { Ionicons } from '@expo/vector-icons';

export default function ReportScreen() {
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');

  const [severity, setSeverity] = useState<'Medium' | 'Severe'>('Medium');
  const [details, setDetails] = useState('');

  /* ---------- PERMISSIONS ---------- */
  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>No access to camera</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  /* ---------- CAMERA ACTIONS ---------- */
  const takePicture = async () => {
    if (cameraRef.current) {
      const result = await cameraRef.current.takePictureAsync();
      setPhoto(result.uri);
      setIsPreview(true);
    }
  };

  const retakePhoto = () => {
    setIsPreview(false);
    setPhoto(null);
    setCameraVisible(true);
  };

  const confirmPhoto = () => {
    setCameraVisible(false);
    setIsPreview(false);
  };

  /* ---------- AI PREDICTION ---------- */
  const analyzePothole = async () => {
    if (!photo) return null;

    const formData = new FormData();
    formData.append('image', {
      uri: photo,
      name: 'pothole.jpg',
      type: 'image/jpeg',
    } as any);

    try {
      const response = await fetch(
        'https://peckier-unentomological-chin.ngrok-free.dev/predict',
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI server error');
      }

      return data;
    } catch (error) {
      Alert.alert('AI Error', 'Failed to analyze image');
      return null;
    }
  };

  /* ---------- SUBMIT REPORT ---------- */
  const handleSubmitReport = async () => {
    if (!photo) {
      Alert.alert('Error', 'Please take a photo of the pothole');
      return;
    }

    if (!auth.currentUser) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setLoading(true);

    const aiResult = await analyzePothole();

    if (!aiResult) {
      setLoading(false);
      return;
    }

    // AI only validates pothole
    if (aiResult.class === 'Normal') {
      Alert.alert(
        'No Pothole Detected',
        'The image does not contain a pothole'
      );
      setLoading(false);
      return;
    }

    if (aiResult.class !== 'Pothole') {
      Alert.alert(
        'Invalid Image',
        'Please capture a clear pothole image'
      );
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'reports'), {
        description: details || "",
        imageUrl: photo || "",
        createdAt: serverTimestamp(),
        severity: severity, // ✅ USER CHOICE
        status: "pending",
        userId: auth.currentUser.uid,
      });

      Alert.alert('Success', 'Pothole report submitted ✅');

      setPhoto(null);
      setDetails('');
      setSeverity('Medium');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report');
    }

    setLoading(false);
  };

  /* ================= CAMERA VIEW ================= */
  if (cameraVisible && !isPreview) {
    return (
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={cameraType}
        flash={flash}
      >
        <View style={styles.topControls}>
          <TouchableOpacity
            onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}
          >
            <Ionicons
              name={flash === 'on' ? 'flash' : 'flash-off'}
              size={28}
              color="white"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              setCameraType(cameraType === 'back' ? 'front' : 'back')
            }
          >
            <Ionicons name="camera-reverse" size={30} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraBottom}>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePicture}
          />
        </View>
      </CameraView>
    );
  }

  /* ================= PHOTO PREVIEW ================= */
  if (isPreview && photo) {
    return (
      <View style={{ flex: 1 }}>
        <Image source={{ uri: photo }} style={{ flex: 1 }} />
        <View style={styles.previewActions}>
          <TouchableOpacity onPress={retakePhoto}>
            <Text style={styles.retake}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmPhoto}>
            <Text style={styles.confirm}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ================= MAIN UI ================= */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Report Pothole</Text>
      <Text style={styles.subtitle}>Earn 50 credits per report</Text>

      <Text style={styles.label}>Photo of Pothole *</Text>
      <TouchableOpacity
        style={styles.photoBox}
        onPress={() => setCameraVisible(true)}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} />
        ) : (
          <>
            <Ionicons name="camera" size={28} color="#4F7DF3" />
            <Text style={styles.photoText}>Take a Photo</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Severity Level *</Text>
      <View style={styles.severityRow}>
        <TouchableOpacity
          style={[
            styles.severityButton,
            severity === 'Medium' && styles.severityMediumActive,
          ]}
          onPress={() => setSeverity('Medium')}
        >
          <Text
            style={[
              styles.severityText,
              severity === 'Medium' && styles.severityTextActive,
            ]}
          >
            Medium
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.severityButton,
            severity === 'Severe' && styles.severitySevereActive,
          ]}
          onPress={() => setSeverity('Severe')}
        >
          <Text
            style={[
              styles.severityText,
              severity === 'Severe' && styles.severityTextActive,
            ]}
          >
            Severe
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Additional Details</Text>
      <TextInput
        style={styles.textArea}
        multiline
        placeholder="Describe the pothole..."
        value={details}
        onChangeText={setDetails}
      />

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmitReport}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            ✓ Submit Report
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.rewardBox}>
        <Text style={styles.rewardLabel}>Reward</Text>
        <Text style={styles.rewardValue}>+50 Credits</Text>
      </View>
    </ScrollView>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#6b7280', marginBottom: 24 },

  label: { fontWeight: '600', marginBottom: 8 },

  photoBox: {
    height: 140,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c7d2fe',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  photo: { width: '100%', height: '100%', borderRadius: 12 },
  photoText: { marginTop: 6, color: '#4F7DF3', fontWeight: '600' },

  severityRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  severityButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },

  severityMediumActive: { backgroundColor: '#ffa600' },
  severitySevereActive: { backgroundColor: '#fb0000a6' },

  severityText: { color: '#5b5e65', fontWeight: '600' },
  severityTextActive: { color: '#fff' },

  textArea: {
    height: 100,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 28,
  },

  submitButton: {
    backgroundColor: '#577fef',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },

  submitText: { color: '#fff', fontWeight: '700' },

  rewardBox: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },

  rewardLabel: { color: '#065F46' },
  rewardValue: { fontWeight: '800', color: '#057350' },

  topControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cameraBottom: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },

  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#ddd',
  },

  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#000',
  },

  retake: { color: '#f87171', fontSize: 16 },
  confirm: { color: '#4ade80', fontSize: 16 },
});
