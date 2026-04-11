import React from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { router } from 'expo-router'
import { signIn } from '@/api/auth'

/**
 * SignInScreen renders the authentication entry point with 
 * Google, Apple (deferred), and Magic Link options.
 */
export default function SignInScreen() {
  const handleGoogleSignIn = async () => {
    const result = await signIn('google')
    if (result.error) {
      Alert.alert('Sign-in Error', result.error.message)
    }
    // Success: handled by AuthProvider's onAuthStateChange
  }

  const handleAppleSignIn = () => {
    Alert.alert('Coming soon', 'Apple sign-in will be available in Phase 2.')
  }

  return (
    <View className="flex-1 items-center justify-center px-6 bg-white dark:bg-gray-900">
      {/* Branding */}
      <View className="items-center mb-12">
        <Text className="text-4xl font-bold text-indigo-500">Halvy</Text>
        <Text className="text-sm text-gray-500 mt-2">Split expenses, not friendships</Text>
      </View>

      {/* Sign-in options */}
      <View className="w-full gap-4">
        {/* Google OAuth (Functional) */}
        <Pressable 
          onPress={handleGoogleSignIn}
          className="w-full h-14 border border-gray-300 rounded-2xl items-center justify-center bg-white active:bg-gray-50"
        >
          <Text className="font-semibold text-gray-700 text-base">Continue with Google</Text>
        </Pressable>

        {/* Apple Sign-In (Disabled Stub) */}
        <Pressable 
          onPress={handleAppleSignIn}
          className="w-full h-14 bg-gray-100 rounded-2xl items-center justify-center opacity-50"
        >
          <Text className="font-semibold text-gray-700 text-base">Continue with Apple</Text>
        </Pressable>

        <View className="flex-row items-center my-4">
          <View className="flex-1 h-[1px] bg-gray-200" />
          <Text className="mx-4 text-gray-400 text-xs uppercase font-medium">or</Text>
          <View className="flex-1 h-[1px] bg-gray-200" />
        </View>

        {/* Magic Link (Functional) */}
        <Pressable 
          onPress={() => router.push('/(auth)/magic-link')}
          className="w-full h-14 bg-indigo-500 rounded-2xl items-center justify-center active:bg-indigo-600"
        >
          <Text className="font-semibold text-white text-base">Sign in with Magic Link</Text>
        </Pressable>
      </View>

      {/* Footer */}
      <View className="mt-12 items-center">
        <Text className="text-xs text-center text-gray-400 leading-relaxed">
          By continuing, you agree to our{' '}
          <Text className="text-gray-500 font-medium">Terms of Service</Text>
          {' '}and{' '}
          <Text className="text-gray-500 font-medium">Privacy Policy</Text>
        </Text>
      </View>
    </View>
  )
}
