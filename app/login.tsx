
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInputProps,
  Alert,
} from 'react-native';
import {
  Shield,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { auth, db } from '../firebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// ── Reusable input field with a left icon and optional right icon ─────────────
type InputProps = TextInputProps & {
  icon: React.ReactNode;       // left decorative icon (Mail, Lock, etc.)
  rightIcon?: React.ReactNode; // optional right element (show/hide password toggle)
};

function Input({ icon, rightIcon, ...props }: InputProps) {
  return (
    <View style={ui.inputBox}>
      {icon}
      <TextInput
        {...props}
        placeholderTextColor="#94A3B8"
        style={ui.input}
      />
      {rightIcon}
    </View>
  );
}

// ── Convert raw Firebase error codes to user-friendly messages ────────────────
// Firebase codes are technical (e.g. "auth/wrong-password"); this keeps UX clean
function getFriendlyError(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Incorrect password. Please try again.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try logging in.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function AuthScreen() {
  const router = useRouter();

  // Whether the user selected "User" or "Admin" role tab
  const [role, setRole] = useState<'user' | 'admin'>('user');

  // Whether the form is in login mode (true) or sign-up mode (false)
  const [isLogin, setIsLogin] = useState(true);

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form field values
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Form submission handler ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Basic presence validation (name + phone required only when user is signing up)
    if (!email || !password || (!isLogin && role === 'user' && (!fullName || !phone))) {
      Alert.alert('Error', 'Please fill all required fields.');
      return;
    }

    if (password.length < 5) {
      Alert.alert('Error', 'Password must be at least 5 characters.');
      return;
    }

    // Password match check (sign-up only)
    if (!isLogin && role === 'user' && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }

    try {
      if (isLogin) {
        // ── Login flow ──────────────────────────────────────────────────────
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Fetch Firestore user doc to check the stored role
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          Alert.alert('Error', 'User data not found!');
          await auth.signOut(); // revoke session if no Firestore doc exists
          return;
        }

        const roleFromDB = docSnap.data().role;

        // Block non-admin accounts from logging in via the Admin tab
        if (role === 'admin' && roleFromDB !== 'admin') {
          await auth.signOut();
          Alert.alert('Access Denied', 'This account is not an admin.', [{ text: 'OK' }]);
          setPassword('');
          setEmail('');
          return;
        }

        // Route to the correct tab stack based on stored role
        if (roleFromDB === 'admin') {
          router.replace('/(admin-tabs)/HomeScreen');
        } else {
          router.replace('/(tabs)/HomeScreen');
        }

      } else {
        // ── Sign-up flow ────────────────────────────────────────────────────
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Store extra user data in Firestore (name, phone, role)
        await setDoc(doc(db, 'users', user.uid), {
          fullName,
          email,
          phone,
          role, // "user" or "admin" (admin self-registration is currently allowed by the form)
        });

        Alert.alert('Success', 'Account created successfully!');

        // Navigate to the correct home screen
        router.replace(role === 'admin' ? '/(admin-tabs)/HomeScreen' : '/(tabs)/HomeScreen');
      }
    } catch (error: any) {
      // Show a human-readable error message instead of the raw Firebase code
      Alert.alert('Error', getFriendlyError(error.code));
    }
  };

  return (
    // Full-screen blue gradient background
    <LinearGradient colors={['#3368db', '#091c56']} style={ui.container}>
      <ScrollView contentContainerStyle={ui.scroll}>

        {/* ── App logo + title ── */}
        <View style={ui.logoWrapper}>
          <View style={ui.logoBox}>
            <Shield size={36} color="#2563EB" />
          </View>
          <Text style={ui.title}>RoadGuard</Text>
          <Text style={ui.subtitle}>AI Pothole Detection & Reporting</Text>
        </View>

        {/* ── Auth card ── */}
        <View style={ui.card}>

          {/* Role toggle: User / Admin */}
          <View style={ui.roleSwitch}>
            <Pressable
              style={[ui.roleButton, role === 'user' && ui.roleActive]}
              onPress={() => setRole('user')}
            >
              <User size={16} color="#2563EB" />
              <Text style={[ui.roleText, role === 'user' && ui.roleTextActive]}>User</Text>
            </Pressable>

            <Pressable
              style={[ui.roleButton, role === 'admin' && ui.roleActive]}
              onPress={() => setRole('admin')}
            >
              <Shield size={16} color="#2563EB" />
              <Text style={[ui.roleText, role === 'admin' && ui.roleTextActive]}>Admin</Text>
            </Pressable>
          </View>

          {/* Full name — only shown when signing up as a user */}
          {role === 'user' && !isLogin && (
            <Input
              icon={<User size={20} color="#94A3B8" />}
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
            />
          )}

          {/* Email — always shown */}
          <Input
            icon={<Mail size={20} color="#94A3B8" />}
            placeholder="Email Address"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {/* Phone — only shown when signing up as a user */}
          {role === 'user' && !isLogin && (
            <Input
              icon={<Phone size={20} color="#94A3B8" />}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          )}

          {/* Password with show/hide toggle */}
          <Input
            icon={<Lock size={20} color="#94A3B8" />}
            placeholder="Password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            rightIcon={
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={20} color="#64748B" /> : <Eye size={20} color="#64748B" />}
              </Pressable>
            }
          />

          {/* Confirm password — only shown on user sign-up */}
          {role === 'user' && !isLogin && (
            <Input
              icon={<Lock size={20} color="#94A3B8" />}
              placeholder="Confirm Password"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              rightIcon={
                <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff size={20} color="#64748B" /> : <Eye size={20} color="#64748B" />}
                </Pressable>
              }
            />
          )}

          {/* Main submit button — label changes based on role + mode */}
          <Pressable style={ui.button} onPress={handleSubmit}>
            <Text style={ui.buttonText}>
              {role === 'admin'
                ? 'Login as Admin'
                : isLogin
                ? 'Login as User'
                : 'Create Account'}
            </Text>
          </Pressable>

          {/* Toggle between Login and Sign-Up (user role only) */}
          {role === 'user' && (
            <Pressable style={ui.switch} onPress={() => setIsLogin(!isLogin)}>
              <Text style={ui.switchText}>
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
              </Text>
            </Pressable>
          )}

          {/* Admin disclaimer box */}
          {role === 'admin' && (
            <View style={ui.warningBox}>
              <Text style={ui.warningText}>Admin Access: Authorized personnel only</Text>
            </View>
          )}
        </View>

        <Text style={ui.footer}>Protected by AI verification system</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const ui = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrapper: { alignItems: 'center', marginBottom: 24 },
  logoBox: { width: 72, height: 72, backgroundColor: 'white', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: 'white' },
  subtitle: { color: '#DBEAFE', marginTop: 4, fontSize: 14 },
  card: { backgroundColor: 'white', borderRadius: 24, padding: 20 },
  roleSwitch: { flexDirection: 'row', backgroundColor: '#EFF6FF', borderRadius: 14, marginBottom: 18, overflow: 'hidden' },
  roleButton: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', padding: 12 },
  roleActive: { backgroundColor: '#d7deec' }, // highlight selected role
  roleText: { fontWeight: '700', color: '#2563EB' },
  roleTextActive: { color: '#2563EB' },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 14 },
  input: { flex: 1, marginLeft: 8, fontSize: 15 },
  button: { backgroundColor: '#1344acea', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  switch: { marginTop: 14, alignItems: 'center' },
  switchText: { color: '#1141aa', fontWeight: '600' },
  warningBox: { marginTop: 14, backgroundColor: '#FFF7ED', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#FED7AA' },
  warningText: { textAlign: 'center', fontSize: 12, color: '#9A3412', fontWeight: '600' },
  footer: { textAlign: 'center', color: '#DBEAFE', marginTop: 20, fontSize: 12 },
});
