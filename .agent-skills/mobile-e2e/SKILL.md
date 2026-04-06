---
name: mobile-e2e
description: >
  Mobile E2E testing for Halvy using Detox. Covers test setup, matchers,
  actions, gestures, network mocking, and critical user flow coverage.
  Triggers: "e2e", "Detox", "end-to-end", "integration test", "user flow",
  "Maestro", "mobile test".
---

# Mobile E2E Testing — Halvy (Detox)

## Framework
- **Detox** for React Native E2E (not Playwright — not available on mobile)
- **Maestro** as lightweight alternative for critical flow smoke tests
- **Jest** for unit and integration tests
- **React Native Testing Library** for component tests

## React Native / Expo Considerations
- For the current React Native + Expo stack, Detox supports modern React Native app architectures. Ensure interactive components expose stable `testID`s, and add proper accessibility props (for example, `accessible={true}` where appropriate) so elements remain queryable when text- or hierarchy-based selectors are unreliable.

## Critical User Flows to Cover (Phase 5 exit criteria)
1. `create_expense_manual.yaml` — Manual expense → card in chat → items unassigned
2. `assign_items.yaml` — Member assigns items → balance updates live
3. `record_payment.yaml` — Settle tab → record payment → system message → balances recalc
4. `create_ocr.yaml` — Photo receipt → OCR preview → confirm → card posted
5. `create_voice.yaml` — Dictate expense → voice preview → confirm → card posted

## Detox Setup (React Native)
```js
// .detoxrc.js
module.exports = {
  testRunner: { args: { '$0': 'jest', config: 'e2e/jest.config.js' } },
  apps: {
    'ios.debug': { type: 'ios.app', binaryPath: 'ios/build/...' },
    'android.debug': { type: 'android.apk', binaryPath: 'android/app/...' }
  },
  devices: {
    simulator: { type: 'ios.simulator', device: { type: 'iPhone 14' } },
    emulator: { type: 'android.emulator', device: { avdName: 'Pixel_6_API_33' } }
  }
}
```

## Detox Test Pattern
```ts
import { device, element, by, expect } from 'detox'

describe('Expense Creation', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  it('creates a manual expense and posts card to chat', async () => {
    // Navigate to group
    await element(by.id('group-card-group-id')).tap()

    // Open expense picker
    await element(by.id('chat-add-button')).tap()
    await element(by.text('Manual')).tap()

    // Fill form
    await element(by.id('expense-title-input')).typeText('Dinner')
    await element(by.id('expense-amount-input')).typeText('93.75')

    // Submit
    await element(by.id('expense-submit-button')).tap()

    // Verify card in chat
    await expect(element(by.id('expense-card-Dinner'))).toBeVisible()
    await expect(element(by.text('$93.75'))).toBeVisible()
  })
})
```

## Maestro (Lightweight Smoke Tests)
```yaml
# e2e/flows/create_expense_manual.yaml
appId: com.halvy.app
---
- launchApp
- tapOn: "Groups"
- tapOn:
    id: "group-card-*"
- tapOn:
    id: "chat-add-button"
- tapOn: "Manual"
- inputText:
    id: "expense-title-input"
    text: "Dinner"
- inputText:
    id: "expense-amount-input"
    text: "93.75"
- tapOn:
    id: "expense-submit-button"
- assertVisible:
    text: "Dinner"
- assertVisible:
    text: "$93.75"
```

## testID Convention
All interactive elements must have `testID` props:
```tsx
<Pressable testID="chat-add-button" onPress={openPicker}>
<TextInput testID="expense-title-input" />
<FlashList ... testID="chat-message-list" />
```

## What to Test at Each Level

### Unit (Jest — src/features/**/utils/)
- `splitCalculator.ts` — all split types, largest remainder, proportional tax
- `debtGraph.ts` — simplification algorithm
- `memberMatcher.ts` — fuzzy matching
- `ocrResponseParser.ts` — parse failures, edge cases

### Integration (RNTL — src/features/**/__tests__/)
- Component rendering with mock data
- Hook behavior with mocked Supabase client
- Form validation flows

### E2E (Detox / Maestro)
- 5 critical user flows above
- Never mock Supabase in E2E — use staging environment
- Reset test data before each suite with seed script

## Coverage Target
- Unit: 80%+ on all utils/ files
- Integration: all API hooks covered
- E2E: 5 critical flows passing on staging before Phase 5 sign-off
