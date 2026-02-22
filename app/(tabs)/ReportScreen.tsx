import React, { useRef, useState, useEffect } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db, storage } from "../../firebaseConfig";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

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
  Animated,
} from "react-native";

import {
  CameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
} from "expo-camera";

import { Ionicons } from "@expo/vector-icons";

export default function ReportScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressAnim = useRef(new Animated.Value(0)).current;

  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [severity, setSeverity] = useState<"Medium" | "Severe">("Medium");
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState("Main Street & 5th Avenue, Downtown");

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>No access to camera</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

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

  // ✅ FIXED AI CALL
  const analyzePothole = async () => {
    if (!photo) return null;

    const formData = new FormData();
    formData.append("image", {
      uri: photo,
      name: "pothole.jpg",
      type: "image/jpeg",
    } as any);

    try {
      const response = await fetch(
        "https://peckier-unentomological-chin.ngrok-free.dev/predict",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI server error");
      }

      return data;
    } catch (error) {
      Alert.alert("AI Error", "Failed to analyze image");
      return null;
    }
  };

  const handleSubmitReport = async () => {
    if (!photo)
      return Alert.alert("Error", "Please take a photo of the pothole");

    if (!auth.currentUser)
      return Alert.alert("Error", "You must be logged in");

    setLoading(true);
    setProgress(0);

    const aiResult = await analyzePothole();

    if (!aiResult) {
      setLoading(false);
      return;
    }

    // ✅ BULLETPROOF VALIDATION
    const predictedClass = aiResult.class?.trim().toLowerCase();
    const confidence = aiResult.confidence ?? 1;

    if (predictedClass !== "pothole" || confidence < 0.75) {
      Alert.alert(
        "Invalid Image",
        "This image does not contain a pothole."
      );
      setLoading(false);
      return;
    }

    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError("Network request failed"));
        xhr.responseType = "blob";
        xhr.open("GET", photo, true);
        xhr.send(null);
      });

      const fileName = `reports/${auth.currentUser.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);

      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: "image/jpeg",
      });

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const percent =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(percent);
          },
          (error) => reject(error),
          () => resolve(true)
        );
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

      await addDoc(collection(db, "reports"), {
        description: details || "",
        imageUrl: downloadURL,
        createdAt: serverTimestamp(),
        severity,
        location,
        status: "pending",
        userId: auth.currentUser.uid,
      });

      Alert.alert("Success", "AI verified pothole report submitted ✅");

      setPhoto(null);
      setDetails("");
      setSeverity("Medium");
      setProgress(0);
      setLocation("Main Street & 5th Avenue, Downtown");
    } catch (error: any) {
      Alert.alert("Upload failed: " + error.message);
    }

    setLoading(false);
  };

  const useCurrentLocation = () => {
    setLocation("Current GPS Location");
  };

  if (cameraVisible && !isPreview) {
    return (
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing={cameraType} flash={flash}>
        <View style={styles.topControls}>
          <TouchableOpacity onPress={() => setFlash(flash === "off" ? "on" : "off")}>
            <Ionicons name={flash === "on" ? "flash" : "flash-off"} size={28} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCameraType(cameraType === "back" ? "front" : "back")}>
            <Ionicons name="camera-reverse" size={30} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.cameraBottom}>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture} />
        </View>
      </CameraView>
    );
  }

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

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Report Pothole</Text>
      <Text style={styles.subtitle}>Earn 50 credits per report</Text>

      <Text style={styles.label}>Photo of Pothole *</Text>
      <TouchableOpacity style={styles.photoBox} onPress={() => setCameraVisible(true)}>
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
          style={[styles.severityButton, severity === "Medium" && styles.severityMediumActive]}
          onPress={() => setSeverity("Medium")}
        >
          <Text style={[styles.severityText, severity === "Medium" && styles.severityTextActive]}>
            Medium
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.severityButton, severity === "Severe" && styles.severitySevereActive]}
          onPress={() => setSeverity("Severe")}
        >
          <Text style={[styles.severityText, severity === "Severe" && styles.severityTextActive]}>
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

      <Text style={styles.label}>Location *</Text>
      <View style={styles.locationBox}>
        <Ionicons name="location-outline" size={18} color="#6b7280" />
        <Text style={styles.locationText}>{location}</Text>
      </View>

      <TouchableOpacity style={styles.useLocation} onPress={useCurrentLocation}>
        <Ionicons name="navigate" size={16} color="#4F7DF3" />
        <Text style={styles.useLocationText}>Use Current Location</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitButton, loading ? styles.submitButtonUploading : styles.submitButtonIdle]}
        onPress={handleSubmitReport}
        disabled={loading}
      >
        <View style={styles.submitButtonContainer}>
          {loading && <Animated.View style={[styles.submitButtonProgress, { width: animatedWidth }]} />}
          <Text style={styles.submitButtonText}>
            {loading ? `Uploading ${Math.round(progress)}%` : "✓ Submit Report"}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.rewardBox}>
        <Text style={styles.rewardLabel}>Reward</Text>
        <Text style={styles.rewardValue}>+50 Credits</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  title: { fontSize: 22, fontWeight: "700", marginBottom: 4, color: "#111827" },
  subtitle: { color: "#6B7280", marginBottom: 24 },

  label: { fontWeight: "600", marginBottom: 8, color: "#111827" },

  photoBox: {
    height: 140,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#C7D2FE",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "#F9FAFB",
  },
  photo: { width: "100%", height: "100%", borderRadius: 12 },
  photoText: { marginTop: 6, color: "#4F7DF3", fontWeight: "600" },

  severityRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  severityButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    marginHorizontal: 5,
  },
  severityMediumActive: { backgroundColor: "#F59E0B" },
  severitySevereActive: { backgroundColor: "#EF4444" },
  severityText: { color: "#6B7280", fontWeight: "600" },
  severityTextActive: { color: "#fff" },

  textArea: {
    height: 100,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 12,
    marginBottom: 28,
    textAlignVertical: "top",
  },

  submitButton: { height: 50, borderRadius: 12, overflow: "hidden", marginBottom: 20 },
  submitButtonIdle: { backgroundColor: "#577FEF" },
  submitButtonUploading: { backgroundColor: "#D1D5DB" },
  submitButtonContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    width: "100%",
  },
  submitButtonProgress: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#577FEF", zIndex: 0 },
  submitButtonText: { color: "#fff", fontWeight: "700", zIndex: 1 },

  rewardBox: { backgroundColor: "#ECFDF5", padding: 16, borderRadius: 12, alignItems: "center" },
  rewardLabel: { color: "#065F46" },
  rewardValue: { fontWeight: "800", color: "#057350" },

  topControls: { position: "absolute", top: 50, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between" },
  cameraBottom: { position: "absolute", bottom: 40, alignSelf: "center" },
  captureButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", borderWidth: 4, borderColor: "#ddd" },

  previewActions: { flexDirection: "row", justifyContent: "space-around", padding: 16, backgroundColor: "#000" },
  retake: { color: "#F87171", fontSize: 16 },
  confirm: { color: "#4ADE80", fontSize: 16 },

  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  locationText: { color: '#3c5782' },
  useLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    padding: 14,
    borderRadius: 10,
    marginBottom: 24,
  },
  useLocationText: { color: '#4F7DF3', fontWeight: '600' },
});
