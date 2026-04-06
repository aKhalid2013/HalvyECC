---
name: expo-mobile
description: >
  Expo and React Native patterns for Halvy. Triggers: "component",
  "screen", "navigation", "expo", "NativeWind", "mobile", "React Native".
---

# Expo / React Native Development — Halvy Patterns

## Project Setup
- Expo SDK 52 managed workflow with Expo Router v4
- React Native 0.76 (New Architecture enabled by default)
- React 18
- NativeWind v4 (Tailwind CSS syntax)
- Supabase backend
- TypeScript strict mode
- FlashList (not FlatList) for all scrollable lists

## Explicit Dependencies (SDK 52 — must be listed, never assume transitive)
These are NOT guaranteed as transitive installs — add them explicitly in package.json:
- `babel-preset-expo` as a **devDependency** (pin to `~52.0.x` matching SDK version)
- `react-native-worklets` — required peer dep of `react-native-reanimated@4.x`; install via `npx expo install react-native-worklets`
- `react-native-web`, `react-dom`, `@expo/metro-runtime` — required for web platform support

## babel.config.js — Critical Pattern
`nativewind/babel` returns `{ plugins: [...] }` — it is a **preset**, not a plugin.
Place it in `presets[]` or Metro will throw: `.plugins is not a valid Plugin property`
```js
// CORRECT
presets: ['babel-preset-expo', 'nativewind/babel']
plugins: [['module-resolver', { alias: { '@': './src' } }]]

// WRONG — causes silent build failures
plugins: ['nativewind/babel']
```

## Build Verification
`tsc` and `jest` do NOT validate Metro/Babel transforms. Always run before merging:
```sh
npx expo export --platform ios
npx expo export --platform android
npx expo export --platform web
```
Zero test files → jest exits 0. This is NOT a build confirmation.

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
