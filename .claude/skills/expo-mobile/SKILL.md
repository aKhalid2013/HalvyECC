---
name: expo-mobile
description: >
  Expo and React Native patterns for Halvy. Triggers: "component",
  "screen", "navigation", "expo", "NativeWind", "mobile", "React Native".
---

# Expo / React Native Development — Halvy Patterns

## Project Setup
- Expo SDK managed workflow with Expo Router v3
- NativeWind v4 (Tailwind CSS syntax)
- Supabase backend
- TypeScript strict mode
- FlashList (not FlatList) for all scrollable lists

## Feature File Structure
src/features/{name}/
  components/   — Feature-specific UI components
  hooks/        — TanStack Query hooks and local state hooks
  utils/        — Pure functions (no React)
  __tests__/    — Integration tests

## Critical Rules
- No window or document — not available in React Native
- No div/span/p — use View, Text, Pressable from react-native
- Always handle keyboard avoidance on input screens
- Always handle safe area insets
- Always use deep linking for navigable screens
- Use expo-image over Image for performance
- FlashList over FlatList for long lists — always
- All monetary amounts in integer cents — never floats

## NativeWind Rules
- className with Tailwind utilities on all RN components
- Platform-specific: className="ios:pt-2 android:pt-4"
- Dark mode: className="bg-white dark:bg-gray-900"
- Never mix StyleSheet.create with className in the same component
- Use design tokens from tailwind.config.ts

## Screen Pattern
import { ScrollView } from 'react-native'
import { Stack } from 'expo-router'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function FeatureScreen() {
  return (
    <ErrorBoundary>
      <Stack.Screen options={{ title: 'Feature' }} />
      <ScrollView className="flex-1 bg-background">
        {/* content */}
      </ScrollView>
    </ErrorBoundary>
  )
}

## Supabase Realtime Pattern (Chat)
useEffect(() => {
  const channel = supabase
    .channel('chat:' + groupId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public',
      table: 'messages', filter: 'group_id=eq.' + groupId,
    }, handleNewMessage)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [groupId])

## Monetary Arithmetic
// ALWAYS: convert to cents on entry, format on display only
const amountCents = Math.round(parseFloat(input) * 100)
// NEVER: parseFloat('1.10') + parseFloat('2.20') — float errors
