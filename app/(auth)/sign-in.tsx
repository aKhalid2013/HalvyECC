import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { signIn } from '../../src/api/auth';

export default function SignInScreen() {
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    const { error } = await signIn('google');
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="text-4xl font-bold text-indigo-500 mb-2">Halvy</Text>
      <Text className="text-sm text-gray-500 mb-8">Split expenses, not friendships</Text>

      <Pressable
        onPress={handleGoogleSignIn}
        className="w-full bg-white border border-gray-300 py-4 rounded-xl flex-row items-center justify-center mb-4"
      >
        <Text className="text-gray-700 font-semibold">Continue with Google</Text>
      </Pressable>

      <Pressable
        disabled={true}
        className="w-full bg-white border border-gray-200 py-4 rounded-xl flex-row items-center justify-center mb-4 opacity-50"
      >
        <Text className="text-gray-400 font-semibold">Continue with Apple</Text>
        <Text className="text-xs text-gray-400 ml-2">(Coming soon)</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(auth)/magic-link')}
        className="w-full bg-indigo-500 py-4 rounded-xl flex-row items-center justify-center"
      >
        <Text className="text-white font-semibold">Sign in with Magic Link</Text>
      </Pressable>

      <Text className="text-xs text-gray-400 mt-8 text-center px-4">
        By continuing, you agree to our Terms of Service
      </Text>
    </View>
  );
}
