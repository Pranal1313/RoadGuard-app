import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { View, ActivityIndicator } from 'react-native';

export default function AdminTabsLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/login');
        return;
      }

      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists() || snap.data().role !== 'admin') {
        router.replace('/login');
        return;
      }

      setChecking(false); // ✅ admin verified
    });

    return unsub;
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="HomeScreen" options={{ title: 'Admin Home' }} />
      <Tabs.Screen name="ManageReports" options={{ title: 'Manage Reports' }} />
    </Tabs>
  );
}
