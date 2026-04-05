> This file adapts [web/design-quality.md](../web/design-quality.md) for React Native / NativeWind mobile screens.

# Mobile Design Quality Standards

## Anti-Template Policy

Do not ship generic template-looking screens. Every screen must feel intentional, specific to Halvy's identity — a chat-first Gen Z social app — not a default Expo/NativeWind scaffold.

### Banned Patterns

- Uniform `p-4` padding on every element with no visual rhythm
- Plain white background + gray text + one indigo accent — no depth, no character
- Default card grids where every card looks identical
- FlatList / ScrollView + map instead of FlashList (also a performance violation)
- `StyleSheet.create` mixed with `className` in the same component (NativeWind rule)
- Undesigned loading states — bare `ActivityIndicator` with no layout shell
- Empty states with centered grey text and no illustration or action affordance
- Expense amounts displayed without proper monetary hierarchy (amount font tokens vs body tokens)
- Balance chips that don't visually distinguish positive / negative / zero states

### Required Qualities

Every meaningful screen or component should demonstrate at least four of these:

1. **Scale contrast** — clear hierarchy between amounts, labels, and metadata (use `amountLg`, `h2`, `caption` tokens — never `body` for everything)
2. **Intentional spacing rhythm** — use layout tokens (`cardPadding`, `sectionGap`, `itemGap`) rather than ad-hoc padding everywhere
3. **Depth and surface layering** — shadow tokens (`shadows.sm`, `shadows.md`) on cards; bubbleExpense / surfaceRaised on expense cards
4. **Semantic color** — debt is always `debtColor`/`debtBg`; credit is `creditColor`/`creditBg`; never raw hex; never use color alone to convey meaning (pair with icon)
5. **Designed press/focus states** — Pressable elements scale to 0.97 on press (100ms Reanimated); inputs show `borderFocus` (2px) on focus
6. **Motion that clarifies** — Expense Card expand/collapse (250ms easeInOut), balance chip color cross-fade (300ms), not decoration for its own sake
7. **Typography with intent** — use the typed token (`typography.amountLg`, `typography.h2`) not arbitrary fontSize; Inter numbers render clean
8. **Accessibility baked in** — all interactive elements 44×44px minimum; `accessibilityLabel` on all icons; financial amounts never conveyed by color alone

## Before Writing a New Screen

1. Identify which design-system tokens apply (colors, spacing, typography, shadows, radius).
2. Confirm the screen's role — chat UI, financial data view, modal, settings — and apply the matching density.
3. Reference the relevant wireframe in `assets/wireframes/` if it exists; flag if it's missing.
4. Check `AccessibilityInfo.isReduceMotionEnabled()` is respected for any animated component.

## Component Checklist

- [ ] Does it avoid looking like a default Expo/NativeWind starter?
- [ ] Does it use design token constants — never raw hex, never arbitrary px?
- [ ] Are monetary amounts displayed with the correct amount font tokens?
- [ ] Do positive/negative/zero balance states have distinct visual treatments?
- [ ] Are press states implemented (Reanimated scale or opacity)?
- [ ] Is the empty state designed — not just gray text in a View?
- [ ] Does it pass the "would this look real in an App Store screenshot?" test?
- [ ] Are all touch targets ≥ 44×44px?
- [ ] Is dark mode correct (tested with darkTokens, not just light)?
