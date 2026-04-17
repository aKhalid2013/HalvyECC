---
name: maestro-flows
description: >
  Maestro mobile E2E flow patterns for Halvy iOS and Android builds.
  Use when writing YAML-based user flow tests for mobile. Triggers: "maestro",
  "mobile E2E", "YAML flow", "iOS test", "Android test", "mobile automation",
  ".maestro/", "appId", "launchApp".
origin: Halvy ECC
sources:
  - https://maestro.mobile.dev
  - https://docs.expo.dev/eas/workflows/examples/e2e-tests/
---

# Maestro Mobile E2E Flows — Halvy

## Overview

Maestro flows are YAML files in `.maestro/flows/`. They run against a built
`.apk` (Android) or `.app` (iOS Simulator) binary. No TypeScript, no setup.
Use for happy-path user journeys. Use Detox when you need internal state assertions.

## App ID

```yaml
# Must match bundleIdentifier in app.config.ts
appId: com.halvy.app
```

## Critical Requirement: testID Props

Maestro finds elements by `id:` which maps to the React Native `testID` prop.
**Add `testID` to every interactive element before writing flows:**

```typescript
<TextInput testID="email-input" />
<TextInput testID="expense-amount-input" />
<Pressable testID="new-expense-btn" />
<Pressable testID="save-expense-btn" />
<Pressable testID="send-magic-link-btn" />
<Text testID="expense-total-display" />
```

## Flow Syntax Reference

```yaml
appId: com.halvy.app
---
- launchApp                           # Fresh app launch
- tapOn:
    id: "new-expense-btn"             # By testID
- tapOn:
    text: "Split equally"             # By visible text
- inputText: "250"                    # Type into focused input
- clearText                           # Clear focused input
- assertVisible:
    text: "Expense saved"
    timeout: 5000                     # ms to wait
- assertVisible:
    id: "expense-total-display"
- swipe:
    direction: LEFT
    element: { id: "expense-row" }
- scroll
- waitForAnimationToEnd
- inputText: ${TEST_EMAIL}            # Use env variable
```

## Compose Flows

```yaml
# auth-and-create.yaml
appId: com.halvy.app
---
- runFlow: auth-sign-in.yaml
- runFlow: create-expense.yaml
```

## Running Flows

```bash
maestro test .maestro/flows/smoke-test.yaml
maestro test .maestro/flows/                              # All flows
maestro test .maestro/flows/auth-sign-in.yaml --env TEST_USER_EMAIL=user@test.com
```

## CI Integration (EAS + GitHub Actions)

```yaml
- name: Build iOS E2E binary
  run: npx eas build --platform ios --profile e2e --local --output app.app

- name: Run Maestro flows
  uses: mobile-dev-inc/action-maestro-cloud@v1
  with:
    api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
    app-file: app.app
    flow-file: .maestro/flows/
```

## EAS e2e Profile (add to eas.json)

```json
{
  "build": {
    "e2e": {
      "distribution": "internal",
      "ios": { "simulator": true },
      "android": { "buildType": "apk" },
      "env": { "APP_ENV": "test" }
    }
  }
}
```

## Maestro vs Detox

| Use Maestro | Use Detox |
|-------------|-----------|
| Full user journeys | Assert Zustand store state |
| YAML (no TS) | Verify AsyncStorage |
| Smoke tests | Complex gestures |
| Multi-device CI | Deep link testing |
