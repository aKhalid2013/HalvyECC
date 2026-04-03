# design-system.md
**Project:** Halvy — Next-Gen Social Expense Splitting Ecosystem  
**Version:** 1.1  
**Depends on:** project-structure.md

---

## Assumptions & Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Visual style | Clean & minimal with warm accents | WhatsApp-inspired; content-first, no decorative clutter |
| Primary brand color | Indigo-Violet `#5C6BC0` | Trust + social; distinctive in fintech space |
| Font | Inter (via expo-google-fonts) | Exceptional number rendering; modern fintech standard |
| Border radius | Moderate — 12px cards/inputs, 16px buttons/modals, 999px chips | Friendly but financially credible |
| Base spacing unit | 8px | Standard density; consistent rhythm across all screens |
| Dark mode | Full light + dark support | System-preference driven; token-based theming |
| Debt indicator | Color + icon (arrow up/down) | Clearest financial signal at a glance |
| Expense Card | Compact by default, tap to expand | Chat thread stays readable; detail on demand |
| Visual references | Annotated wireframes alongside text specs | Text specs define behavior; wireframes define visual layout |

---

## 1. Color Tokens

All colors are defined as tokens in `src/constants/colors.ts`. Components never use raw hex values — always reference tokens.

### 1.1 Brand Palette

```typescript
// src/constants/colors.ts

export const palette = {
  // Primary — Indigo Violet
  indigo50:  '#EDE7F6',
  indigo100: '#D1C4E9',
  indigo200: '#B39DDB',
  indigo300: '#9575CD',
  indigo400: '#7E57C2',
  indigo500: '#5C6BC0',  // Primary brand color
  indigo600: '#4A5DB0',
  indigo700: '#3949AB',
  indigo800: '#303F9F',
  indigo900: '#283593',

  // Success — Teal Green
  teal50:    '#E0F2F1',
  teal400:   '#26C6DA',
  teal500:   '#26A69A',  // Success / received money
  teal600:   '#00897B',

  // Danger — Warm Red
  red50:     '#FFEBEE',
  red400:    '#EF5350',  // Debt / owed money
  red600:    '#E53935',

  // Warning — Amber
  amber50:   '#FFF8E1',
  amber400:  '#FFA726',  // Pending / low OCR confidence
  amber600:  '#FB8C00',

  // Neutrals
  white:     '#FFFFFF',
  gray50:    '#FAFAFA',
  gray100:   '#F5F5F5',
  gray200:   '#EEEEEE',
  gray300:   '#E0E0E0',
  gray400:   '#BDBDBD',
  gray500:   '#9E9E9E',
  gray600:   '#757575',
  gray700:   '#616161',
  gray800:   '#424242',
  gray900:   '#212121',
  black:     '#000000',

  // Dark mode surfaces
  dark50:    '#1A1A2E',
  dark100:   '#16213E',
  dark200:   '#0F3460',
  dark300:   '#1E1E2E',
  dark400:   '#2A2A3E',
  dark500:   '#3A3A4E',
}
```

### 1.2 Semantic Tokens

```typescript
export const lightTokens = {
  bgPrimary:       palette.white,
  bgSecondary:     palette.gray50,
  bgTertiary:      palette.gray100,
  bgInverse:       palette.gray900,
  surfacePrimary:  palette.white,
  surfaceRaised:   palette.white,
  surfaceOverlay:  palette.gray50,
  brandPrimary:    palette.indigo500,
  brandLight:      palette.indigo50,
  brandDark:       palette.indigo700,
  textPrimary:     palette.gray900,
  textSecondary:   palette.gray600,
  textTertiary:    palette.gray400,
  textInverse:     palette.white,
  textBrand:       palette.indigo500,
  textLink:        palette.indigo500,
  debtColor:       palette.red400,
  debtBg:          palette.red50,
  creditColor:     palette.teal500,
  creditBg:        palette.teal50,
  pendingColor:    palette.amber400,
  pendingBg:       palette.amber50,
  settledColor:    palette.teal500,
  borderLight:     palette.gray200,
  borderMedium:    palette.gray300,
  borderFocus:     palette.indigo500,
  bubbleOutgoing:  palette.indigo500,
  bubbleIncoming:  palette.gray100,
  bubbleSystem:    palette.gray200,
  bubbleExpense:   palette.white,
  statusSuccess:   palette.teal500,
  statusError:     palette.red400,
  statusWarning:   palette.amber400,
  statusInfo:      palette.indigo500,
  buttonPrimary:   palette.indigo500,
  buttonSecondary: palette.gray100,
  buttonDanger:    palette.red400,
  buttonDisabled:  palette.gray300,
}

export const darkTokens: typeof lightTokens = {
  bgPrimary:       palette.dark300,
  bgSecondary:     palette.dark400,
  bgTertiary:      palette.dark500,
  bgInverse:       palette.white,
  surfacePrimary:  palette.dark400,
  surfaceRaised:   palette.dark500,
  surfaceOverlay:  palette.dark300,
  brandPrimary:    palette.indigo400,
  brandLight:      palette.indigo900,
  brandDark:       palette.indigo200,
  textPrimary:     palette.gray50,
  textSecondary:   palette.gray400,
  textTertiary:    palette.gray600,
  textInverse:     palette.gray900,
  textBrand:       palette.indigo300,
  textLink:        palette.indigo300,
  debtColor:       palette.red400,
  debtBg:          '#3D1A1A',
  creditColor:     palette.teal400,
  creditBg:        '#1A3D3A',
  pendingColor:    palette.amber400,
  pendingBg:       '#3D2E1A',
  settledColor:    palette.teal400,
  borderLight:     palette.dark500,
  borderMedium:    '#4A4A5E',
  borderFocus:     palette.indigo400,
  bubbleOutgoing:  palette.indigo600,
  bubbleIncoming:  palette.dark500,
  bubbleSystem:    palette.dark400,
  bubbleExpense:   palette.dark400,
  statusSuccess:   palette.teal400,
  statusError:     palette.red400,
  statusWarning:   palette.amber400,
  statusInfo:      palette.indigo400,
  buttonPrimary:   palette.indigo400,
  buttonSecondary: palette.dark500,
  buttonDanger:    palette.red400,
  buttonDisabled:  palette.dark500,
}
```

### 1.3 useTheme Hook

```typescript
import { useColorScheme } from 'react-native'

export function useTheme() {
  const scheme = useColorScheme()
  return scheme === 'dark' ? darkTokens : lightTokens
}
```

All components call `useTheme()` to access colors. No component reads `useColorScheme()` directly.

---

## 2. Typography

### 2.1 Font Setup

```typescript
// app/_layout.tsx
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'
```

### 2.2 Type Scale

```typescript
// src/constants/typography.ts

export const typography = {
  display:   { fontFamily: 'Inter_700Bold',     fontSize: 28, lineHeight: 36, letterSpacing: -0.5 },
  h1:        { fontFamily: 'Inter_700Bold',     fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
  h2:        { fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 26, letterSpacing: -0.2 },
  h3:        { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22 },
  bodyLg:    { fontFamily: 'Inter_400Regular',  fontSize: 16, lineHeight: 24 },
  body:      { fontFamily: 'Inter_400Regular',  fontSize: 14, lineHeight: 20 },
  bodyMd:    { fontFamily: 'Inter_500Medium',   fontSize: 14, lineHeight: 20 },
  caption:   { fontFamily: 'Inter_400Regular',  fontSize: 12, lineHeight: 16 },
  captionMd: { fontFamily: 'Inter_500Medium',   fontSize: 12, lineHeight: 16 },
  label:     { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  amountLg:  { fontFamily: 'Inter_700Bold',     fontSize: 24, lineHeight: 32, letterSpacing: -0.5 },
  amount:    { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22 },
  amountSm:  { fontFamily: 'Inter_500Medium',   fontSize: 13, lineHeight: 18 },
}
```

---

## 3. Spacing

```typescript
// src/constants/spacing.ts — Base unit: 8px

export const spacing = {
  px: 1, 0.5: 4, 1: 8, 1.5: 12, 2: 16, 2.5: 20, 3: 24, 4: 32, 5: 40, 6: 48, 8: 64, 10: 80, 12: 96,
}

export const layout = {
  screenPaddingH:     spacing[2],     // 16px
  screenPaddingV:     spacing[2],     // 16px
  cardPadding:        spacing[2],     // 16px
  sectionGap:         spacing[3],     // 24px
  itemGap:            spacing[1],     // 8px
  inlineGap:          spacing[1],     // 8px
  chatBubblePaddingH: spacing[1.5],   // 12px
  chatBubblePaddingV: spacing[1],     // 8px
  tabBarHeight:       56,
  headerHeight:       56,
  inputHeight:        48,
  buttonHeight:       48,
  avatarSm:           32,
  avatarMd:           40,
  avatarLg:           56,
}
```

---

## 4. Border Radius

```typescript
// src/constants/radius.ts
export const radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 999 }
```

---

## 5. Shadows

```typescript
// src/constants/shadows.ts
import { Platform } from 'react-native'

export const shadows = {
  none: {},
  sm: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
    android: { elevation: 4 },
    default: {},
  }),
  lg: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16 },
    android: { elevation: 8 },
    default: {},
  }),
}
```

---

## 6. Core Components

Specifications for Button, Avatar, BalanceChip, ExpenseCard, MessageBubble, Input, Card, Modal/Bottom Sheet, ReconnectingBanner, and EmptyState are defined in `screens-and-navigation.md` alongside their screen context. Key design rules:

- **Button:** Variants: primary | secondary | danger | ghost. Sizes: sm (36px) | md (48px) | lg (56px). Disabled: buttonDisabled bg, opacity 0.6. Loading: ActivityIndicator replaces label.
- **Avatar:** Circular, sizes sm/md/lg, radius.full. Fallback: brandLight bg + textBrand initials. Reliability badge: bottom-right overlay, 14px circle.
- **BalanceChip:** Positive: creditBg + arrow-up. Negative: debtBg + arrow-down. Zero: bgTertiary + minus. Shape: radius.full pill.
- **ExpenseCard:** surfacePrimary bg, borderLight 1px, radius.md, shadows.sm. Compact default, expands on tap. Status chips: pending/flagged/settled/deleted.
- **MessageBubble:** Outgoing: bubbleOutgoing bg, textInverse, aligned right. Incoming: bubbleIncoming bg, textPrimary, aligned left. System: bubbleSystem, centered, italic. Max width 75%.
- **Input:** Height 48px, borderMedium 1px, borderFocus on focus (2px), radius.sm.
- **Card:** surfacePrimary bg, radius.md, shadows.sm. Pressable variant scales 0.98.
- **Modal:** surfacePrimary bg, radius.xl top corners, handle bar 4×32px gray300, backdrop black 0.5 opacity, max 85% height.
- **ReconnectingBanner:** pendingBg, "Reconnecting…" captionMd, WifiOff icon, 32px height, slides down.
- **EmptyState:** 64px icon textTertiary, h3 title, body textSecondary centered (max 260px), CTA Button primary sm.

---

## 7. Financial Amount Display Rules

```typescript
// src/utils/currency.ts
export function formatAmount(amount: number, currency: string, options?: { showSign?: boolean; compact?: boolean }): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    notation: options?.compact ? 'compact' : 'standard',
  }).format(Math.abs(amount))
  if (options?.showSign) return amount >= 0 ? `+${formatted}` : `-${formatted}`
  return formatted
}
```

| Context | Style | Example |
|---|---|---|
| Group balance (positive) | creditColor + arrow-up + `+` prefix | ↑ +$42.50 |
| Group balance (negative) | debtColor + arrow-down + `-` prefix | ↓ -$18.00 |
| Group balance (zero) | textTertiary, no icon | $0.00 |
| Expense total | textPrimary, amount font | $93.75 |
| Split amount owed | debtColor, amountSm | $31.25 |
| Split amount settled | textTertiary, amountSm, strikethrough | ~~$31.25~~ |
| Line item amount | textSecondary, amountSm | $20.00 |
| Tax / tip line item | textTertiary, amountSm, italic | $7.50 |

---

## 8. Iconography

All icons use `lucide-react-native`. No mixing of icon libraries. Key mappings:

| Usage | Icon | Size |
|---|---|---|
| Credit / positive | `ArrowUp` | 14px |
| Debt / negative | `ArrowDown` | 14px |
| Add expense | `Plus` | 24px |
| OCR camera | `Camera` | 24px |
| Voice | `Mic` | 24px |
| Settled | `Check` | 16px |
| Flagged | `Flag` | 16px |
| Pending | `Clock` | 14px |
| Expand/collapse | `ChevronDown`/`ChevronUp` | 16px |
| Members | `Users` | 20px |
| Settings | `Settings` | 20px |
| Notifications | `Bell` | 20px |
| Delete | `Trash2` | 18px |
| Edit | `Edit3` | 18px |
| Reconnecting | `WifiOff` | 14px |
| Reliability | `Star` | 14px |

---

## 9. Animation Guidelines

All animations use **Reanimated 3**. No Animated API from React Native core.

| Interaction | Animation | Duration |
|---|---|---|
| Expense Card expand/collapse | Height + opacity | 250ms, easeInOut |
| Chat bubble appear | Slide up + fade in | 200ms, easeOut |
| Button press | Scale 1.0 → 0.97 | 100ms |
| Bottom sheet open | Slide up | 300ms, spring (damping 20) |
| Bottom sheet close | Slide down | 250ms, easeIn |
| ReconnectingBanner appear | Slide down from top | 200ms, easeOut |
| Toast notification | Slide down + fade | 200ms, easeOut |
| Balance chip update | Color cross-fade | 300ms |
| Tab switch | Opacity fade | 150ms |

---

## 10. NativeWind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: '#5C6BC0', credit: '#26A69A', debt: '#EF5350', pending: '#FFA726' },
      fontFamily: { regular: ['Inter_400Regular'], medium: ['Inter_500Medium'], semibold: ['Inter_600SemiBold'], bold: ['Inter_700Bold'] },
      borderRadius: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
    }
  },
  plugins: [],
}
```

> **Note:** NativeWind is used for layout and spacing utilities. Color and typography always reference typed tokens from `src/constants/` — never raw Tailwind color classes.

---

## 11. Accessibility

| Rule | Implementation |
|---|---|
| Minimum touch target | 44×44px on all interactive elements |
| Color contrast | All text meets WCAG AA (4.5:1 minimum) in both light and dark |
| Financial amounts | Never conveyed by color alone — always include icon or label |
| Screen reader labels | All icons have `accessibilityLabel` props |
| Focus indicators | `borderFocus` color on all focused inputs and buttons |
| Reduced motion | Check `AccessibilityInfo.isReduceMotionEnabled` — skip animations if true |

---

## 12. File Locations Summary

| File | Responsibility |
|---|---|
| `src/constants/colors.ts` | Palette, semantic tokens, `useTheme` hook |
| `src/constants/typography.ts` | Type scale definitions |
| `src/constants/spacing.ts` | Spacing scale + layout aliases |
| `src/constants/radius.ts` | Border radius tokens |
| `src/constants/shadows.ts` | Platform shadow definitions |
| `src/utils/currency.ts` | Amount formatting utility |
| `src/components/Avatar.tsx` | Avatar with badge + chip overlays |
| `src/components/BalanceChip.tsx` | Net balance pill |
| `src/components/Button.tsx` | Primary, secondary, danger, ghost |
| `src/components/Card.tsx` | Generic pressable/static card |
| `src/components/Input.tsx` | Text input with label + error |
| `src/components/Modal.tsx` | Bottom sheet wrapper |
| `src/components/ReconnectingBanner.tsx` | Connection loss indicator |
| `src/components/EmptyState.tsx` | Empty list fallback |
| `src/features/chat/components/MessageBubble.tsx` | Chat message bubble |
| `src/features/expenses/components/ExpenseCard.tsx` | Expandable expense bubble |

---

## 13. Wireframe Guidelines

### 13.1 Purpose

Text specifications in this document and `screens-and-navigation.md` define component behavior, data dependencies, and interaction logic. However, text alone cannot communicate visual layout, spatial rhythm, and proportional relationships between elements. **Annotated wireframes** fill this gap.

The rule is: text specs are the source of truth for **what happens**; wireframes are the source of truth for **how it looks**.

### 13.2 Required Wireframes

Every screen in `screens-and-navigation.md` should have a corresponding wireframe. Priority wireframes (create these first):

| Wireframe | Why it's high priority |
|---|---|
| Group chat screen (4.5) | The core experience; chat bubble sizing, balance strip layout, and ExpenseCard proportions must be visually validated |
| ExpenseCard — compact + expanded states | Most complex component; two states with different layouts, confidence indicators, split rows |
| Expense creation — OCR preview (4.7) | Line item list with confidence highlights, total mismatch warning — spacing-sensitive |
| Expense creation — Voice preview (4.7) | Multiple card layout with unresolved name pickers — unique layout |
| Expense creation — Manual form (4.7) | Split type selector, dynamic member lists — interaction-heavy form |
| Settlements screen (4.9) | From/to avatar arrows, summary card — financial data density |
| Draft restore prompt | Small but critical UX moment — must feel unobtrusive |

### 13.3 Wireframe Standards

- **Format:** PNG or SVG, stored in `assets/wireframes/`.
- **Naming:** Match section numbers: `4.5-group-chat.png`, `4.7-ocr-preview.png`, `6.3-expense-card-expanded.png`.
- **Annotations:** Call out spacing values (in px), color token names (not hex), typography token names, and radius values. Use leader lines pointing to specific elements.
- **States:** Component wireframes should show all relevant states side by side (e.g., ExpenseCard compact vs. expanded, BalanceChip positive vs. negative vs. zero).
- **Dark mode:** At minimum, wireframe the chat screen and expense card in dark mode to validate dark token choices.
- **Platform:** Wireframe for iPhone 14 dimensions (390 × 844px) as the reference size. Note any Android-specific differences (e.g., elevation vs. shadow).

### 13.4 Conflict Resolution

If a wireframe and a text spec disagree:
1. Determine which was updated more recently.
2. If the text spec was updated, update the wireframe to match.
3. If the wireframe was updated (e.g., after visual testing), update the text spec to match.
4. Both should always be in sync before a phase is marked complete.

AI agents implementing screens should reference both the text spec and the wireframe. If no wireframe exists for a screen, the agent should flag it in the completion checklist as a gap.
