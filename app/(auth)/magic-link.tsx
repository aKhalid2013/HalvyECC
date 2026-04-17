import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { signIn } from '../../src/api/auth';

export default function MagicLinkScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

  const handleSendLink = async () => {
    setError(null);
    const { error } = await signIn('magic_link', email);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
      setResendCountdown(60);
    }
  };

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-2xl font-bold text-indigo-500 mb-4">Check your email</Text>
        <Text className="text-center text-gray-600 mb-8">
          We sent a sign-in link to <Text className="font-semibold">{email}</Text>
        </Text>

        <Pressable 
          disabled={resendCountdown > 0}
          onPress={handleSendLink}
          className={`w-full py-4 rounded-xl items-center mb-4 ${resendCountdown > 0 ? 'bg-gray-200' : 'bg-indigo-500'}`}
        >
          <Text className={`${resendCountdown > 0 ? 'text-gray-400' : 'text-white'} font-semibold`}>
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text className="text-indigo-500 font-semibold">Back to sign-in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="text-2xl font-bold text-indigo-500 mb-2">Sign in with email</Text>
      <Text className="text-sm text-gray-500 mb-8">We'll email you a magic link to sign in.</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        className="w-full border border-gray-300 rounded-xl p-4 mb-4"
        testID="email-input"
      />

      {error && <Text className="text-red-500 text-sm mb-4">{error}</Text>}

      <Pressable 
        onPress={handleSendLink}
        disabled={!isValidEmail(email)}
        accessibilityState={{ disabled: !isValidEmail(email) }}
        className={`w-full py-4 rounded-xl items-center mb-4 ${!isValidEmail(email) ? 'bg-gray-200' : 'bg-indigo-500'}`}
        testID="send-magic-link-btn"
      >
        <Text className={`${!isValidEmail(email) ? 'text-gray-400' : 'text-white'} font-semibold`}>
          Send Magic Link
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text className="text-indigo-500 font-semibold">Back to sign-in</Text>
      </Pressable>
    </View>
  );
}
