---
name: react-native-expo
description: >
  React Native and Expo patterns for Halvy. Covers Expo Router v3,
  NativeWind v4, FlashList, safe areas, keyboard handling, deep linking,
  Reanimated 3, and Expo-specific APIs. Triggers: "component", "screen",
  "navigation", "NativeWind", "FlashList", "Reanimated", "Expo", "mobile".
---

# React Native / Expo — Halvy Patterns

## Project Setup
- Expo SDK managed workflow with Expo Router v3
- NativeWind v4 (Tailwind CSS syntax on RN components)
- TypeScript strict mode — no `any`
- FlashList (not FlatList) for all scrollable lists
- Reanimated 3 for all animations (no Animated API)
- lucide-react-native for all icons (no mixing libraries)

## Feature File Structure
```
src/features/{name}/
  components/   — Feature-specific UI (< 300 lines each)
  hooks/        — TanStack Query + local state hooks
  utils/        — Pure functions, no React
  types/        — TypeScript types for this feature
  __tests__/    — Unit + integration tests
```

## Screen Template
```tsx
import { ScrollView } from 'react-native'
import { Stack } from 'expo-router'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function FeatureScreen() {
  const insets = useSafeAreaInsets()
  return (
    <ErrorBoundary>
      <Stack.Screen options={{ title: 'Feature' }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {/* content */}
      </ScrollView>
    </ErrorBoundary>
  )
}
```

## NativeWind v4 Rules
- `className` with Tailwind utilities on all RN components
- Platform variants: `className="ios:pt-2 android:pt-4"`
- Dark mode: `className="bg-white dark:bg-gray-900"`
- NEVER mix `StyleSheet.create` with `className` in same component
- Color tokens from `src/constants/colors.ts` — never raw hex in className
- Typography tokens from `src/constants/typography.ts`

## FlashList (mandatory for lists)
```tsx
import { FlashList } from '@shopify/flash-list'

<FlashList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  estimatedItemSize={72}      // always set — affects performance
  keyExtractor={(item) => item.id}
/>
```
Never use FlatList. Never use ScrollView + map for long lists.

## Reanimated 3 Patterns
```tsx
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming
} from 'react-native-reanimated'

// Button press scale
const scale = useSharedValue(1)
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }]
}))
// onPressIn: scale.value = withSpring(0.97)
// onPressOut: scale.value = withSpring(1.0)
```
Duration guidelines from design-system.md:
- Button press: 100ms
- Card expand: 250ms easeInOut
- Bottom sheet open: 300ms spring (damping 20)
- Balance chip color: 300ms cross-fade

## Supabase Realtime (Chat)
```tsx
useEffect(() => {
  const channel = supabase
    .channel(`messages:${groupId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `group_id=eq.${groupId}`,
    }, handleNewMessage)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [groupId])
```

## Safe Area & Keyboard
- Always wrap screens with `useSafeAreaInsets()`
- Chat input screens: use `KeyboardAvoidingView` with `behavior="padding"` on iOS
- Tab bar height: 56px (from design-system spacing.tabBarHeight)

## Deep Linking
- All navigable screens must have a deep link configured in `app.config.ts`
- Use `expo-router` `<Link>` for internal navigation
- Never use `router.push` with raw strings — use typed routes

## Critical Rules
- No `window` or `document` — not available in React Native
- No `div`/`span`/`p` — use `View`, `Text`, `Pressable`
- `expo-image` over `Image` for all images
- All monetary amounts in integer cents — never floats
- Error boundaries on every screen root
- `AccessibilityInfo.isReduceMotionEnabled()` — skip animations if true
- All touch targets minimum 44×44px

## Monetary Arithmetic
```ts
// CORRECT: convert to cents on entry, format only on display
const amountCents = Math.round(parseFloat(input) * 100)

// NEVER: float arithmetic
// parseFloat('1.10') + parseFloat('2.20') → 3.3000000000000003
```
