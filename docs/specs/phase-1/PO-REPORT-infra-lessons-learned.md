# PO Report: Infrastructure Build Issues — Lessons Learned

**Date:** 2026-04-05
**Phase:** 1 — Foundation
**Spec:** SPEC-001-expo-infrastructure
**To:** Product Owner / Agent System
**From:** Implementation Agent

---

## What Happened

During implementation of SPEC-001 (Expo project infrastructure), all automated checks passed cleanly:
- `tsc --noEmit` — exited 0
- `npx jest` — exited 0 (no test files found)

Yet the app failed to bundle and run on device with multiple errors. Three separate debugging rounds were required before the app ran cleanly across all platforms.

---

## Root Causes

### 1. `nativewind/babel` placed in `plugins[]` instead of `presets[]`

`nativewind/babel` is a **Babel preset** (it returns `{ plugins: [...] }`), not a Babel plugin. When placed in `plugins[]`, Metro throws at bundle time:

```
.plugins is not a valid Plugin property
```

Neither `tsc` nor `jest` (with zero test files) exercise the Babel pipeline. This error is invisible until you run `expo export` or open the app.

**Fix:** Move `nativewind/babel` to `presets[]` in `babel.config.js`.

### 2. `react-native-worklets` missing — Reanimated 4 peer dep

`react-native-reanimated@4.x` has a new peer dependency on `react-native-worklets@0.5 - 0.8`. This package is a new split introduced in Reanimated 4. It is not installed automatically by `npx expo install react-native-reanimated`.

The error only surfaces when Metro resolves the Reanimated Babel plugin:

```
Cannot find module 'react-native-worklets/plugin'
```

**Fix:** `npx expo install react-native-worklets`

### 3. `babel-preset-expo` not guaranteed as a transitive install in SDK 54

In Expo SDK 54, `babel-preset-expo` is no longer reliably available as a transitive dependency. It must be listed explicitly as a `devDependency` and pinned to `~54.0.x`.

Without it, the build fails with:

```
Cannot find module 'babel-preset-expo'
```

**Fix:** Add `"babel-preset-expo": "~54.0.x"` to `devDependencies` explicitly.

### 4. Web platform packages not installed

`react-native-web`, `react-dom`, and `@expo/metro-runtime` are required for web platform support but are not auto-installed. The `expo export --platform web` command fails without them.

**Fix:** `npx expo install react-native-web react-dom @expo/metro-runtime`

---

## Why the Standard Test Suite Didn't Catch This

| Check | What it validates | What it misses |
|-------|-------------------|----------------|
| `tsc --noEmit` | TypeScript type correctness | Metro config, Babel transforms, bundler pipeline |
| `npx jest` | Jest test files | If no test files exist, exits 0 unconditionally |
| `npx jest` (with files) | Component/utility logic | Metro resolution, native modules, Babel presets |

The entire Metro + Babel + native module resolution pipeline is only exercised by:
1. Actually running the app on a device/simulator
2. Running `npx expo export --platform ios/android/web`

Option 2 is the correct automated oracle and was not in the Phase 1 exit criteria.

---

## Recommended Changes

### 1. Add `expo export` to Phase 1 Exit Criteria

The current exit criteria include:
```
□ npx tsc --noEmit passes
□ npx jest passes
□ App launches on iOS, Android, and web without errors
```

The third criterion requires a human with devices. The automated equivalent should be:
```
□ npx expo export --platform ios passes (no build errors)
□ npx expo export --platform android passes (no build errors)
□ npx expo export --platform web passes (no build errors)
```

This catches all Metro/Babel errors without needing a device and should be the CI gate for infrastructure work.

### 2. Add Explicit Dependency Checklist to SPEC-001 / Phase 1 Deliverables

The deliverables list should explicitly call out packages that must be listed in `package.json` — not assumed transitive:

- `babel-preset-expo` as a devDependency (SDK-version-pinned)
- `react-native-worklets` (Reanimated 4 peer dep)
- `react-native-web`, `react-dom`, `@expo/metro-runtime` (web platform)

### 3. Add `babel.config.js` Correctness Note to Phase 1 Spec

The spec should call out the `nativewind/babel` placement rule explicitly, as it is a non-obvious constraint that any future agent or developer would hit.

---

## Impact

- Delayed: 1 session
- Rework: 4 incremental fix cycles
- Platforms affected: iOS, Android, Web
- Resolution: All three platforms now bundle cleanly. No functional regressions.

---

## Questions for PO Agent

1. Should `expo export --platform {ios,android,web}` be added as a mandatory CI step in the `eas.json` or GitHub Actions workflow?
2. Should the infrastructure SPEC template include a "Bundler Verification" acceptance criterion for any spec that touches `babel.config.js`, `metro.config.js`, or adds native dependencies?
3. Is there an appropriate place in `docs/phases/README.md` to document the `expo export` oracle so all future phase implementations inherit it?
