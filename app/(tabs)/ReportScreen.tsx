
import React, { useRef, useState, useEffect } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  arrayUnion,
} from "firebase/firestore";
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
  Platform,
  StatusBar,
} from "react-native";

import {
  CameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
} from "expo-camera";

import { Ionicons } from "@expo/vector-icons";
import LocationPickerModal from "../components/LocationPickerModal";

export default function ReportScreen() {
  // Ref to the camera so we can call takePictureAsync()
  const cameraRef = useRef<CameraView>(null);

  // Camera permission state from expo-camera
  const [permission, requestPermission] = useCameraPermissions();

  // Whether the live camera view is on screen
  const [cameraVisible, setCameraVisible] = useState(false);

  // URI of the captured photo (null = no photo yet)
  const [photo, setPhoto] = useState<string | null>(null);

  // Whether we're in the "preview the captured photo" state
  const [isPreview, setIsPreview] = useState(false);

  // Tracks upload/submission in progress
  const [loading, setLoading] = useState(false);

  // Upload progress 0–100 (drives the animated progress bar)
  const [progress, setProgress] = useState(0);

  // Animated value for the submit button progress bar fill
  const progressAnim = useRef(new Animated.Value(0)).current;

  // front / back camera toggle
  const [cameraType, setCameraType] = useState<CameraType>("back");

  // flash on / off
  const [flash, setFlash] = useState<FlashMode>("off");

  // Pothole severity selected by the user
  const [severity, setSeverity] = useState<"Medium" | "Severe">("Medium");

  // Optional free-text description
  const [details, setDetails] = useState("");

  // Human-readable address chosen from LocationPickerModal
  const [location, setLocation] = useState("Tap to set location");

  // Lat/lng coordinates paired with the address
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Controls visibility of the location picker modal
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  // Smoothly animate the progress bar whenever `progress` changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false, // width is a layout property, can't use native driver
    }).start();
  }, [progress]);

  // ── Guard: camera permissions not yet determined ──
  if (!permission) return <View />;

  // ── Guard: permission denied → show grant button ──
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>No access to camera</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  // ── Take a picture and enter preview mode ──────────────────────────────────
  const takePicture = async () => {
    if (cameraRef.current) {
      const result = await cameraRef.current.takePictureAsync();
      setPhoto(result.uri);   // store local URI
      setIsPreview(true);     // switch to preview view
    }
  };

  // Discard the photo and go back to the live camera
  const retakePhoto = () => {
    setIsPreview(false);
    setPhoto(null);
    setCameraVisible(true);
  };

  // Accept the photo and return to the report form
  const confirmPhoto = () => {
    setCameraVisible(false);
    setIsPreview(false);
  };

  // ── Send photo to the AI server for pothole detection ─────────────────────
  const analyzePothole = async () => {
    if (!photo) return null;

    // Build multipart form data with the image file
    const formData = new FormData();
    formData.append("image", { uri: photo, name: "pothole.jpg", type: "image/jpeg" } as any);

    try {
      const response = await fetch(
        "https://peckier-unentomological-chin.ngrok-free.dev/predict",
        { method: "POST", body: formData }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI server error");
      return data; // { class: "pothole", confidence: 0.97, ... }
    } catch (error) {
      Alert.alert("AI Error", "Failed to analyze image");
      return null;
    }
  };

  // ── Find the master (non-corroboration) report for a given location ────────
  const getMasterReport = async (locationStr: string) => {
    const q = query(collection(db, "reports"), where("location", "==", locationStr));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    // The master doc is the one where isCorroboration !== true
    const masterDoc = snap.docs.find((d) => (d.data() as any).isCorroboration !== true);
    return masterDoc ?? null;
  };

  // ── Count unique reporters for a given location ────────────────────────────
  // Returns the count, master doc ID, and list of reporter UIDs
  const getUniqueReporterCount = async (locationStr: string): Promise<{
    count: number;
    masterDocId: string | null;
    corroboratedBy: string[];
  }> => {
    const q = query(collection(db, "reports"), where("location", "==", locationStr));
    const snap = await getDocs(q);
    if (snap.empty) return { count: 0, masterDocId: null, corroboratedBy: [] };

    const masterDoc = snap.docs.find((d) => (d.data() as any).isCorroboration !== true);
    if (!masterDoc) return { count: 0, masterDocId: null, corroboratedBy: [] };

    const masterData = masterDoc.data() as any;

    // Prefer the stored corroboratedBy array if it exists
    if (masterData.corroboratedBy && masterData.corroboratedBy.length > 0) {
      return { count: masterData.corroboratedBy.length, masterDocId: masterDoc.id, corroboratedBy: masterData.corroboratedBy };
    }

    // Fallback: deduplicate userIds across all docs at this location
    const uniqueUserIds = Array.from(new Set(snap.docs.map((d) => (d.data() as any).userId))) as string[];
    return { count: uniqueUserIds.length, masterDocId: masterDoc.id, corroboratedBy: uniqueUserIds };
  };

  // ── Check if this user already submitted for this exact location ──────────
  const hasUserAlreadyReported = async (locationStr: string): Promise<boolean> => {
    const q = query(
      collection(db, "reports"),
      where("location", "==", locationStr),
      where("userId", "==", auth.currentUser!.uid)
    );
    const snap = await getDocs(q);
    return snap.size > 0;
  };

  // ── Reset all form fields after a successful submission ────────────────────
  const resetForm = () => {
    setPhoto(null);
    setDetails("");
    setSeverity("Medium");
    setProgress(0);
    setLocation("Tap to set location");
    setCoords(null);
  };

  // ── Main submit handler ────────────────────────────────────────────────────
  const handleSubmitReport = async () => {
    // Basic validation
    if (!photo) return Alert.alert("Error", "Please take a photo of the pothole");
    if (!auth.currentUser) return Alert.alert("Error", "You must be logged in");
    if (location === "Tap to set location") return Alert.alert("Error", "Please set a location");

    setLoading(true);
    setProgress(0);

    // Step 1: Run AI classification
    const aiResult = await analyzePothole();
    if (!aiResult) { setLoading(false); return; }

    const predictedClass = aiResult.class?.trim().toLowerCase();
    const confidence = aiResult.confidence ?? 1;

    // Reject if the AI doesn't detect a pothole with ≥75% confidence
    if (predictedClass !== "pothole" || confidence < 0.75) {
      Alert.alert("Invalid Image", "This image does not contain a pothole.");
      setLoading(false);
      return;
    }

    try {
      // Step 2: Prevent duplicate submission from same user at same location
      const alreadyReported = await hasUserAlreadyReported(location);
      if (alreadyReported) {
        Alert.alert("Already Reported", "You have already submitted a report for this location.");
        setLoading(false);
        return;
      }

      // Step 3: Check how many unique reporters exist at this location
      const { count: reporterCount, masterDocId, corroboratedBy } = await getUniqueReporterCount(location);

      // Cap at 3 reporters per pothole — extra reports are unnecessary
      if (reporterCount >= 3) {
        Alert.alert(
          "Pothole Already Reported 📢",
          `This pothole has already been reported by ${reporterCount} users. It is under review. Thank you for your concern! 🙏`
        );
        setLoading(false);
        return;
      }

      // Step 4: Convert the local photo URI to a Blob for Firebase upload
      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError("Network request failed"));
        xhr.responseType = "blob";
        xhr.open("GET", photo, true);
        xhr.send(null);
      });

      // Step 5: Upload image to Firebase Storage with progress tracking
      const fileName = `reports/${auth.currentUser.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: "image/jpeg" });

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            // Update progress % as bytes are transferred
            setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          },
          reject,
          () => resolve(true)
        );
      });

      // Get the public download URL after upload completes
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

      // Step 6a: Corroboration — another user is confirming an existing report
      if (reporterCount > 0 && masterDocId) {
        const newCount = reporterCount + 1;

        // Increment corroboration count on the master document
        await updateDoc(doc(db, "reports", masterDocId), {
          corroborationCount: newCount,
          corroboratedBy: arrayUnion(auth.currentUser.uid),  // add this user to the list
          corroboratorImages: arrayUnion(downloadURL),        // store their photo too
          isCorroboration: false,                             // master stays as master
        });

        // Also create a separate corroboration sub-document
        await addDoc(collection(db, "reports"), {
          description: details || "",
          imageUrl: downloadURL,
          createdAt: serverTimestamp(),
          severity,
          location,
          coords: coords ?? null,
          status: "pending",
          userId: auth.currentUser.uid,
          creditEligible: true,
          creditsAwarded: false,
          isCorroboration: true,      // marks this as a secondary/corroboration doc
          originalReportId: masterDocId,
          corroborationCount: newCount,
        });

        Alert.alert("Thanks for Confirming! 🙌", `${newCount} users have now reported this pothole. You'll earn 50 credits once an admin verifies it.`);
      } else {
        // Step 6b: First report for this location — create the master document
        await addDoc(collection(db, "reports"), {
          description: details || "",
          imageUrl: downloadURL,
          createdAt: serverTimestamp(),
          severity,
          location,
          coords: coords ?? null,
          status: "pending",
          userId: auth.currentUser.uid,
          creditEligible: true,
          creditsAwarded: false,
          isCorroboration: false,              // this is the master
          corroborationCount: 1,
          corroboratedBy: [auth.currentUser.uid],   // start the reporters list
          corroboratorImages: [downloadURL],
        });

        Alert.alert("Report Submitted ✅", "Your report was submitted! You'll earn 50 credits once an admin verifies it.");
      }

      resetForm();
    } catch (error: any) {
      Alert.alert("Upload failed: " + error.message);
    }

    setLoading(false);
  };

  // ── Live camera screen ─────────────────────────────────────────────────────
  if (cameraVisible && !isPreview) {
    return (
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing={cameraType} flash={flash}>
        {/* Back button to exit camera without taking a photo */}
        <TouchableOpacity style={styles.cameraBackBtn} onPress={() => setCameraVisible(false)}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        {/* Flash toggle and camera flip buttons (top-right) */}
        <View style={styles.topControls}>
          <TouchableOpacity onPress={() => setFlash(flash === "off" ? "on" : "off")}>
            <Ionicons name={flash === "on" ? "flash" : "flash-off"} size={28} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCameraType(cameraType === "back" ? "front" : "back")}>
            <Ionicons name="camera-reverse" size={30} color="white" />
          </TouchableOpacity>
        </View>

        {/* Shutter button at the bottom */}
        <View style={styles.cameraBottom}>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture} />
        </View>
      </CameraView>
    );
  }

  // ── Photo preview screen ───────────────────────────────────────────────────
  // Shown after taking a photo; user can retake or confirm
  if (isPreview && photo) {
    return (
      <View style={{ flex: 1 }}>
        <Image source={{ uri: photo }} style={{ flex: 1 }} />
        <View style={styles.previewActions}>
          <TouchableOpacity onPress={retakePhoto}><Text style={styles.retake}>Retake</Text></TouchableOpacity>
          <TouchableOpacity onPress={confirmPhoto}><Text style={styles.confirm}>Confirm</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  // Interpolate progress 0–100 → "0%"–"100%" for animated bar width
  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  // ── Main report form ───────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Report Pothole</Text>
      <Text style={styles.subtitle}>Earn 50 credits per verified report</Text>

      {/* Photo section — tapping opens the camera */}
      <Text style={styles.label}>Photo of Pothole *</Text>
      <TouchableOpacity style={styles.photoBox} onPress={() => setCameraVisible(true)}>
        {photo ? (
          // Show the captured photo as a preview inside the box
          <Image source={{ uri: photo }} style={styles.photo} />
        ) : (
          // Placeholder with camera icon and label
          <>
            <Ionicons name="camera" size={28} color="#4F7DF3" />
            <Text style={styles.photoText}>Take a Photo</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Severity selector: Medium or Severe */}
      <Text style={styles.label}>Severity Level *</Text>
      <View style={styles.severityRow}>
        <TouchableOpacity
          style={[styles.severityButton, severity === "Medium" && styles.severityMediumActive]}
          onPress={() => setSeverity("Medium")}
        >
          <Text style={[styles.severityText, severity === "Medium" && styles.severityTextActive]}>Medium</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.severityButton, severity === "Severe" && styles.severitySevereActive]}
          onPress={() => setSeverity("Severe")}
        >
          <Text style={[styles.severityText, severity === "Severe" && styles.severityTextActive]}>Severe</Text>
        </TouchableOpacity>
      </View>

      {/* Optional description text area */}
      <Text style={styles.label}>Additional Details</Text>
      <TextInput
        style={styles.textArea}
        multiline
        placeholder="Describe the pothole..."
        value={details}
        onChangeText={setDetails}
      />

      {/* Location row — opens LocationPickerModal on press */}
      <Text style={styles.label}>Location *</Text>
      <TouchableOpacity style={styles.locationBox} onPress={() => setLocationPickerVisible(true)}>
        <Ionicons name="location-outline" size={18} color="#6b7280" />
        <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
        <Ionicons name="chevron-forward" size={16} color="#6b7280" />
      </TouchableOpacity>

      {/* Modal that shows a map and GPS auto-detect for location selection */}
      <LocationPickerModal
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onConfirm={(address, c) => { setLocation(address); setCoords(c); }}
      />

      {/* Submit button — shows animated upload progress while loading */}
      <TouchableOpacity
        style={[styles.submitButton, loading ? styles.submitButtonUploading : styles.submitButtonIdle]}
        onPress={handleSubmitReport}
        disabled={loading} // prevent double-tap
      >
        <View style={styles.submitButtonContainer}>
          {/* Animated progress fill behind the label text */}
          {loading && <Animated.View style={[styles.submitButtonProgress, { width: animatedWidth }]} />}
          <Text style={styles.submitButtonText}>
            {loading ? `Uploading ${Math.round(progress)}%` : "✓ Submit Report"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Reward info box at the bottom */}
      <View style={styles.rewardBox}>
        <Text style={styles.rewardLabel}>Reward</Text>
        <Text style={styles.rewardValue}>+50 Credits</Text>
        <Text style={styles.rewardNote}>Awarded after admin verification</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4, color: "#3566d0" },
  subtitle: { color: "#6B7280", marginBottom: 24 },
  label: { fontWeight: "600", marginBottom: 8, color: "#111827" },
  photoBox: { height: 140, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C7D2FE", borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 24, backgroundColor: "#F9FAFB" },
  photo: { width: "100%", height: "100%", borderRadius: 12 },
  photoText: { marginTop: 6, color: "#4F7DF3", fontWeight: "600" },
  severityRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  severityButton: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center", marginHorizontal: 5 },
  severityMediumActive: { backgroundColor: "#F59E0B" },
  severitySevereActive: { backgroundColor: "#EF4444" },
  severityText: { color: "#6B7280", fontWeight: "600" },
  severityTextActive: { color: "#fff" },
  textArea: { height: 100, backgroundColor: "#F3F4F6", borderRadius: 10, padding: 12, marginBottom: 28, textAlignVertical: "top" },
  submitButton: { height: 50, borderRadius: 12, overflow: "hidden", marginBottom: 20 },
  submitButtonIdle: { backgroundColor: "#577FEF" },
  submitButtonUploading: { backgroundColor: "#D1D5DB" },
  submitButtonContainer: { flex: 1, justifyContent: "center", alignItems: "center", position: "relative", width: "100%" },
  // Absolute fill that grows from left as upload progresses
  submitButtonProgress: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#577FEF", zIndex: 0 },
  submitButtonText: { color: "#fff", fontWeight: "700", zIndex: 1 },
  rewardBox: { backgroundColor: "#ECFDF5", padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 30 },
  rewardLabel: { color: "#065F46" },
  rewardValue: { fontWeight: "800", color: "#057350" },
  rewardNote: { color: "#6B7280", fontSize: 11, marginTop: 4 },
  // Camera overlay styles
  cameraBackBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 12 : 56,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 8,
    borderRadius: 999,
  },
  topControls: { position: "absolute", top: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 12 : 56, left: 20, right: 20, flexDirection: "row", justifyContent: "flex-end", gap: 16 },
  cameraBottom: { position: "absolute", bottom: 40, alignSelf: "center" },
  captureButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", borderWidth: 4, borderColor: "#ddd" },
  previewActions: { flexDirection: "row", justifyContent: "space-around", padding: 16, backgroundColor: "#000" },
  retake: { color: "#F87171", fontSize: 16 },
  confirm: { color: "#4ADE80", fontSize: 16 },
  locationBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f3f4f6", padding: 14, borderRadius: 10, marginBottom: 24 },
  locationText: { flex: 1, color: "#3c5782" },
});
