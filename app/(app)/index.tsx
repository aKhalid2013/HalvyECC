import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { signOut } from '../../src/api/auth';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="text-2xl font-bold text-indigo-500 mb-2">Welcome, {user?.displayName}</Text>
      <Text className="text-sm text-gray-500 mb-8">{user?.email}</Text>

      <Pressable 
        onPress={handleSignOut}
        className="bg-white border border-red-500 py-3 px-8 rounded-xl"
      >
        <Text className="text-red-500 font-semibold">Sign Out</Text>
      </Pressable>
    </View>
  );
}
