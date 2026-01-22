import React from 'react';
import { Tabs } from 'expo-router';

export default function TabsLayout({ route }: any) {
  const role = route?.params?.role || 'user'; // default to user

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
      }}
    >
      {/* User Screens */}
      <Tabs.Screen name="HomeScreen" options={{ title: 'Home' }} />
      <Tabs.Screen name="ReportScreen" options={{ title: 'Report' }} />

      {/* Admin screen only for admin */}
      {role === 'admin' && (
        <Tabs.Screen
          name="AdminScreen"
          options={{ title: 'Admin' }}
        />
      )}
    </Tabs>
  );
}
