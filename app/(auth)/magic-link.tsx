import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import { router } from 'expo-router'
import { signIn } from '@/api/auth'

type ScreenState = 'input' | 'confirmation'

export default function MagicLinkScreen() {
  const [state, setState] = useState<ScreenState>('input')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(id)
  }, [countdown])

  const isValidEmail = email.includes('@') && email.includes('.')

  const handleSend = async () => {
    if (!isValidEmail || isLoading) return
    setIsLoading(true)
    setError(null)
    const result = await signIn('magic_link', email)
    setIsLoading(false)
    if (result.error) {
      setError('Failed to send link. Please try again.')
    } else {
      setState('confirmation')
      setCountdown(60)
    }
  }

  if (state === 'confirmation') {
    return (
      <View className="flex-1 items-center justify-center px-6 bg-white dark:bg-gray-900">
        <Text className="text-4xl mb-4">✓</Text>
        <Text className="text-xl font-semibold text-gray-900 dark:text-white">Check your email</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          We sent a sign-in link to {email}
        </Text>
        <Pressable
          onPress={handleSend}
          disabled={countdown > 0}
          accessibilityState={{ disabled: countdown > 0 }}
          className={`mt-8 ${countdown > 0 ? 'opacity-50' : ''}`}
        >
          <Text 
            accessibilityState={{ disabled: countdown > 0 }}
            className="text-indigo-500 font-medium"
          >
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-gray-500">Back to sign-in</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="flex-1 px-6 bg-white dark:bg-gray-900" style={{ paddingTop: 60 }}>
      <Pressable onPress={() => router.back()} className="mb-8">
        <Text className="text-indigo-500 font-medium">← Back to sign-in</Text>
      </Pressable>
      
      <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Sign in with email
      </Text>
      <Text className="text-sm text-gray-500 mb-8">
        We&apos;ll send a magic link to your inbox for a passwordless sign-in.
      </Text>

      <View>
        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">
          Email Address
        </Text>
        <TextInput
          value={email}
          onChangeText={(text) => {
            setEmail(text)
            if (error) setError(null)
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          placeholder="you@example.com"
          placeholderTextColor="#9CA3AF"
          className="w-full h-14 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50"
        />
      </View>

      {error && (
        <Text className="text-red-500 text-sm mt-3 ml-1">{error}</Text>
      )}

      <Pressable
        onPress={handleSend}
        disabled={!isValidEmail || isLoading}
        accessibilityState={{ disabled: !isValidEmail || isLoading }}
        className={`w-full h-14 bg-indigo-500 rounded-2xl items-center justify-center mt-6 shadow-sm
          ${(!isValidEmail || isLoading) ? 'opacity-50' : 'active:bg-indigo-600'}`}
      >
        <Text 
          accessibilityState={{ disabled: !isValidEmail || isLoading }}
          className="text-white font-bold text-lg"
        >
          {isLoading ? 'Sending...' : 'Send Magic Link'}
        </Text>
      </Pressable>

      <Text className="text-xs text-center text-gray-400 mt-8 px-8">
        Can&apos;t find the email? Check your spam folder or try another address.
      </Text>
    </View>
  )
}
