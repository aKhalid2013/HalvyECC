import { View, Text, Pressable, Alert } from 'react-native'
import { signOut } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

/**
 * HomeScreen is the main entry point for authenticated users.
 * Displays user profile information and a sign-out mechanism.
 */
export default function HomeScreen() {
  const { user } = useAuthStore()

  const handleSignOut = async () => {
    const result = await signOut()
    if (result.error) {
      Alert.alert('Error', result.error.message)
    }
    // AuthProvider's onAuthStateChange handles store reset 
    // and navigation redirect via index.tsx auth gate.
  }

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
      <View className="items-center mb-12">
        <View className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full items-center justify-center mb-4">
          <Text className="text-3xl">👋</Text>
        </View>
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome, {user?.displayName}
        </Text>
        <Text className="text-sm text-gray-500 mt-1">{user?.email}</Text>
      </View>

      <View className="w-full gap-4">
        <View className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
          <Text className="text-gray-400 text-xs uppercase font-semibold mb-1">Status</Text>
          <Text className="text-gray-900 dark:text-white font-medium">Successfully Authenticated</Text>
        </View>

        <Pressable 
          onPress={handleSignOut}
          className="w-full h-14 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/30 rounded-2xl items-center justify-center active:bg-red-50 dark:active:bg-red-900/10 mt-4"
        >
          <Text className="text-red-500 font-semibold text-base">Sign Out</Text>
        </Pressable>
      </View>

      <Text className="absolute bottom-12 text-gray-400 text-xs text-center px-12">
        You are currently using the Halvy Early Access version.
      </Text>
    </View>
  )
}
