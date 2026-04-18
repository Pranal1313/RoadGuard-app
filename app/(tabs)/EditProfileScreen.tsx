import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { ChevronLeft, User, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  updateEmail, updatePassword, reauthenticateWithCredential,
  EmailAuthProvider, updateProfile,
} from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

export default function EditProfileScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load current user data
  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user) { router.replace('/login'); return; }
      setEmail(user.email || '');
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setFullName(d.fullName || '');
          setPhone(d.phone || '');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Validate name
    if (!fullName.trim()) {
      Alert.alert('Error', 'Full name cannot be empty.');
      return;
    }

    // Validate password fields if user wants to change password
    const wantsPasswordChange = newPassword.length > 0 || confirmPassword.length > 0;
    if (wantsPasswordChange) {
      if (!currentPassword) {
        Alert.alert('Error', 'Please enter your current password to change it.');
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert('Error', 'New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'New passwords do not match.');
        return;
      }
    }

    // If changing email or password, re-auth is required
    const wantsEmailChange = email.trim() !== user.email;
    if ((wantsEmailChange || wantsPasswordChange) && !currentPassword) {
      Alert.alert('Error', 'Please enter your current password to update email or password.');
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate if needed
      if (wantsEmailChange || wantsPasswordChange) {
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      // Update display name in Firebase Auth
      await updateProfile(user, { displayName: fullName.trim() });

      // Update Firestore user doc
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: fullName.trim(),
        phone: phone.trim(),
        ...(wantsEmailChange ? { email: email.trim() } : {}),
      });

      // Update email in Firebase Auth
      if (wantsEmailChange) {
        await updateEmail(user, email.trim());
      }

      // Update password in Firebase Auth
      if (wantsPasswordChange) {
        await updatePassword(user, newPassword);
      }

      Alert.alert('Saved ✅', 'Your profile has been updated successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        Alert.alert('Error', 'Current password is incorrect.');
      } else if (err.code === 'auth/email-already-in-use') {
        Alert.alert('Error', 'That email address is already in use.');
      } else if (err.code === 'auth/invalid-email') {
        Alert.alert('Error', 'Please enter a valid email address.');
      } else {
        Alert.alert('Error', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#042262" />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft color="white" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{ width: 24 }} />
          </View>
        </View>

        <View style={styles.body}>

          {/* ── Personal Info ── */}
          <Text style={styles.sectionLabel}>Personal Information</Text>
          <View style={styles.card}>

            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={styles.inputRow}>
              <User size={16} color="#6B7280" />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={styles.inputRow}>
              <Mail size={16} color="#6B7280" />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Your email"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={styles.inputRow}>
              <Phone size={16} color="#6B7280" />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Your phone number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* ── Change Password ── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Change Password</Text>
          <Text style={styles.sectionHint}>Leave blank if you don't want to change your password.</Text>
          <View style={styles.card}>

            <Text style={styles.fieldLabel}>Current Password</Text>
            <View style={styles.inputRow}>
              <Lock size={16} color="#6B7280" />
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showCurrent}
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeOff size={16} color="#9CA3AF" /> : <Eye size={16} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={styles.inputRow}>
              <Lock size={16} color="#6B7280" />
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showNew}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff size={16} color="#9CA3AF" /> : <Eye size={16} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <View style={styles.inputRow}>
              <Lock size={16} color="#6B7280" />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff size={16} color="#9CA3AF" /> : <Eye size={16} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Note about re-auth */}
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              🔒 Changing your email or password requires your current password for security verification.
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={styles.saveBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#042262',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderRadius: 26,
    marginHorizontal: 3,
    marginTop: 4,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '600' },
  body: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#042262', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHint: { fontSize: 12, color: '#9CA3AF', marginBottom: 10, marginTop: -4 },
  card: { backgroundColor: 'white', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginTop: 14, marginBottom: 4, textTransform: 'uppercase' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14 },
  input: { flex: 1, fontSize: 15, color: '#111827', fontFamily: undefined },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  noteBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginTop: 16, marginBottom: 4 },
  noteText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
  saveBtn: {
    backgroundColor: '#042262', paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
