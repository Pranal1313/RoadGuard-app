import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout({ route }: any) {
  const role = route?.params?.role || 'user';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#2457c4',
        tabBarInactiveTintColor: '#9CA3AF',
      }}
    >
      <Tabs.Screen
        name="HomeScreen"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ReportScreen"
        options={{
          title: 'Report',
          tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="RepairVerificationScreen"
        options={{
          title: 'Verify Repairs',
          tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
            <Ionicons name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="UserProfile"
        options={{
          title: 'My Account',
          tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={color} />
          ),
        }}
      />

      {role === 'admin' && (
        <Tabs.Screen
          name="AdminScreen"
          options={{
            title: 'Admin',
            tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
              <Ionicons name={focused ? 'shield' : 'shield-outline'} size={size} color={color} />
            ),
          }}
        />
      )}
    </Tabs>
  );
}