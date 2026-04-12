import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { signIn, verifyOtp } from '@/api/auth'

type ScreenState = 'input' | 'confirmation'

export default function MagicLinkScreen() {
  const [state, setState] = useState<ScreenState>('input')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [otp, setOtp] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)

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
      setOtp('')
      setOtpError(null)
    }
  }

  const handleOtpChange = async (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 6)
    setOtp(digits)
    setOtpError(null)

    if (digits.length === 6) {
      setIsVerifying(true)
      const result = await verifyOtp(email, digits)
      setIsVerifying(false)
      if (result.error) {
        setOtpError('Invalid or expired code. Try again or request a new link.')
        setOtp('')
      }
      // On success: AuthProvider's onAuthStateChange fires → store updates → auth gate redirects
    }
  }

  if (state === 'confirmation') {
    return (
      <View className="flex-1 px-6 bg-white dark:bg-gray-900" style={{ paddingTop: 60 }}>
        <Pressable onPress={() => router.back()} className="mb-8">
          <Text className="text-indigo-500 font-medium">← Back to sign-in</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Check your email
        </Text>
        <Text className="text-sm text-gray-500 mb-8">
          We sent a sign-in link and code to{' '}
          <Text className="font-semibold text-gray-700 dark:text-gray-300">{email}</Text>
        </Text>

        {/* OTP code input */}
        <View className="mb-8">
          <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">
            Enter 6-digit code
          </Text>
          <View className="relative">
            <TextInput
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              placeholder="——————"
              placeholderTextColor="#D1D5DB"
              editable={!isVerifying}
              className="w-full h-14 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 text-center text-2xl font-bold tracking-widest"
            />
            {isVerifying && (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator color="#5C6BC0" />
              </View>
            )}
          </View>
          {otpError && (
            <Text className="text-red-500 text-sm mt-2 ml-1">{otpError}</Text>
          )}
          <Text className="text-xs text-gray-400 mt-2 ml-1">
            Auto-submits when all 6 digits are entered
          </Text>
        </View>

        {/* Divider */}
        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          <Text className="text-xs text-gray-400 mx-3">or use the email link</Text>
          <View className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        </View>

        <Pressable
          onPress={handleSend}
          disabled={countdown > 0 || isVerifying}
          accessibilityState={{ disabled: countdown > 0 || isVerifying }}
          className={`items-center ${(countdown > 0 || isVerifying) ? 'opacity-50' : ''}`}
        >
          <Text className="text-indigo-500 font-medium">
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend email'}
          </Text>
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
