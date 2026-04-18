import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

      setChecking(false);
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
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#0f7725', tabBarInactiveTintColor: '#9CA3AF' }}>
      <Tabs.Screen
        name="HomeScreen"
        options={{
          title: 'Admin Home',
          tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ManageReports"
        options={{
          title: 'Manage Reports',
          tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
            <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}