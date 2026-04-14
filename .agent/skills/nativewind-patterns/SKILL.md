---
name: nativewind-patterns
description: >
  NativeWind v4 styling patterns for Halvy. Use when styling React Native
  components, implementing dark mode, defining design tokens, or debugging
  className issues. Triggers: "className", "styling", "NativeWind", "Tailwind",
  "dark mode", "tailwind.config", "design tokens", "style", "color scheme".
origin: Halvy ECC
sources:
  - https://www.nativewind.dev/v4/overview
  - https://www.nativewind.dev/v4/guides/dark-mode
  - https://www.nativewind.dev/v4/guides/custom-theme
---

# NativeWind v4 Patterns — Halvy

## Core Rules

1. **`className` on all components.** No `StyleSheet.create()`.
2. **Never mix** `StyleSheet.create()` and `className` in one component.
3. **Dark mode via `dark:` prefix.** Driven by system color scheme automatically.
4. **Design tokens in `tailwind.config.ts`.** Never hardcode hex colors.
5. **No arbitrary values** like `w-[347px]` unless absolutely unavoidable.
6. **No inline `style={{}}` for static layout.** Only use inline style for runtime-
   animated values from Reanimated.

## Component Pattern

```typescript
import { View, Text, Pressable } from 'react-native';

export function ExpenseCard({ title, amount, onPress }: Props) {
  return (
    <Pressable
      className="bg-white dark:bg-neutral-900 rounded-2xl p-4 active:opacity-70"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Expense: ${title}`}
    >
      <Text className="text-base font-medium text-neutral-900 dark:text-neutral-100">
        {title}
      </Text>
      <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
        {amount}
      </Text>
    </Pressable>
  );
}
```

## Platform-Specific Classes

```typescript
<View className="pt-4 ios:pt-6 android:pt-4" />
<View className="web:max-w-2xl web:mx-auto" />
```

## Dark Mode

```typescript
<View className="bg-white dark:bg-neutral-900">
  <Text className="text-neutral-900 dark:text-white">Hello</Text>
</View>

// Read current scheme:
import { useColorScheme } from 'nativewind';
const { colorScheme } = useColorScheme();
```

## tailwind.config.ts Design Tokens

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f9fafb',
          dark: '#171717',
          'dark-secondary': '#262626',
        },
        balance: {
          positive: '#22c55e',
          negative: '#ef4444',
          neutral: '#6b7280',
        },
      },
    },
  },
} satisfies Config;
```

## Forbidden Patterns

```typescript
// ❌ Arbitrary values
<View className="w-[347px]" />

// ❌ Hardcoded hex
<View style={{ backgroundColor: '#6366f1' }} />

// ❌ StyleSheet + NativeWind mixed
const styles = StyleSheet.create({ card: { padding: 16 } });
<View style={styles.card} className="bg-white" />

// ❌ Inline style for static layout
<View style={{ padding: 16, flex: 1 }} />
// ✅
<View className="p-4 flex-1" />
```

## className Not Working — Debug Checklist

1. Verify `nativewind/babel` is in `presets[]` in `babel.config.js`, not `plugins[]`
2. Run `npx expo export --platform ios` to catch Metro pipeline errors
3. Confirm `tailwind.config.ts` content paths include the file
4. Restart Metro with `--clear`: `npx expo start --clear`
