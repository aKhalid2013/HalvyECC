---
id: SPEC-001
title: "Expo Project Infrastructure Setup"
phase: 1
status: approved
priority: P0
complexity: M
created: 2026-04-05
updated: 2026-04-05
depends-on: []
branch: feat/SPEC-001-expo-infrastructure
feasibility: pass
---

# SPEC-001: Expo Project Infrastructure Setup

## 1. Overview

**Problem:** No codebase exists yet. Every subsequent Halvy spec — database, auth, design system, chat, expenses — depends on a working Expo project with TypeScript, NativeWind styling, environment configuration, testing infrastructure, and EAS build profiles. Without this foundation, no feature work can begin.

**Solution:** Initialize a managed Expo project with Expo Router v3, TypeScript strict mode, and NativeWind v4. Configure path aliases, environment variable loading, a typed config helper with startup validation, Jest + React Native Testing Library, EAS build profiles for three environments, and Zustand as the state management dependency. Include a minimal smoke-test screen that proves the NativeWind pipeline is wired correctly end-to-end.

**Fits the vision because:** A chat app with financial intelligence requires a cross-platform shell that runs identically on iOS, Android, and web. This spec establishes that shell with the exact toolchain the design system, real-time chat, and financial engine will build on top of.

---

## 2. User Stories

- As a **developer (or dev agent)**, I want to clone the repo and run `npm install && npx expo start` so that the app launches on iOS, Android, and web without additional setup steps.
- As a **developer**, I want a `@` path alias so that all imports use `@/` instead of relative paths, matching the project conventions in AGENTS.md.
- As a **developer**, I want environment variables loaded from `.env` and validated at startup so that missing or malformed config causes a clear error instead of a silent runtime failure.
- As a **developer**, I want Jest and React Native Testing Library pre-configured so that I can write tests from SPEC-002 onward without any testing setup work.
- As a **developer**, I want EAS build profiles for development, staging, and production so that every phase can produce a deployable staging build as required by the phase gate.
- As a **developer**, I want NativeWind v4 working end-to-end so that all subsequent UI work can use `className` with Tailwind utilities as defined in the design system.

---

## 3. Acceptance Criteria

Each criterion MUST be binary (pass/fail) and testable by the spec-verifier.

- [ ] **AC-1:** Running `npx expo start` launches the app without errors on iOS simulator, Android emulator, and web browser.
- [ ] **AC-2:** `tsconfig.json` has `"strict": true` and `"paths": { "@/*": ["./src/*"] }`, and an import using `@/constants/config` resolves correctly at build time.
- [ ] **AC-3:** `.env.example` exists with all required keys (with dummy values). `.env` is in `.gitignore`. `app.config.ts` reads every variable from `process.env`.
- [ ] **AC-4:** `src/constants/config.ts` exports a typed config object. On app startup, if any required env var is missing or empty, the app throws a descriptive error naming the missing variable — not a silent `undefined`.
- [ ] **AC-5:** `npx jest` runs successfully with zero tests passing (no test files yet) and exits with code 0. Jest is configured with `react-native` preset and `@` alias resolution matching `tsconfig.json` paths.
- [ ] **AC-6:** `eas.json` contains three build profiles: `development` (dev client), `staging` (internal distribution), and `production` (store-ready). Each profile references distinct environment variable groups.
- [ ] **AC-7:** `.env.example` contains placeholder keys for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `GEMINI_API_KEY` with dummy values. No real secrets are committed.
- [ ] **AC-8:** NativeWind v4 is installed with its required babel plugin and metro config. `tailwind.config.js` exists with `content` paths matching `['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}']`.
- [ ] **AC-9:** A smoke-test screen at `app/(app)/index.tsx` renders a `View` with `className="flex-1 items-center justify-center bg-white"` containing a `Text` element displaying "Halvy". The styled layout is visually confirmed on iOS, Android, and web.
- [ ] **AC-10:** `zustand` is installed as a production dependency. Importing `import { create } from 'zustand'` in any `src/` file compiles without error.
- [ ] **AC-11:** The project directory follows the structure from AGENTS.md: `src/features/`, `src/shared/` (with `ui/`, `hooks/`, `utils/`, `types/` subdirectories), `src/constants/`, `src/api/`, `src/stores/`, `src/providers/` all exist as empty directories with `.gitkeep` files.

---

## 4. Data Model

### New Tables

None. This spec is pure client-side infrastructure. No database tables are created, modified, or queried.

### Modified Tables

None.

---

## 5. API Contracts

None. This spec establishes the project skeleton only. No API endpoints are created or called. The Supabase client singleton (`src/api/client.ts`) is deferred to SPEC-003 (Auth).

---

## 6. UI/UX Specifications

### Screen: Smoke Test (`app/(app)/index.tsx`)

This is a temporary verification screen, not a production screen. It will be replaced by the actual Groups tab home screen in Phase 2.

**Layout:**

```tsx
export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
      <Text className="text-2xl font-bold text-indigo-500">
        Halvy
      </Text>
      <Text className="text-sm text-gray-500 mt-2">
        Infrastructure smoke test
      </Text>
    </View>
  );
}
```

**What this verifies:**

- `className` is parsed by NativeWind (not silently ignored)
- Flexbox layout centers correctly on all three platforms
- `dark:` variant syntax is wired up (renders dark background when device is in dark mode)
- Tailwind color classes resolve (`text-indigo-500`, `bg-white`, `text-gray-500`)

**What this is NOT:**

- Not a production screen — no navigation, no auth gate, no design system tokens
- No `useTheme()` hook — that's SPEC-004 territory. Raw Tailwind classes are intentional here to test NativeWind in isolation before the token layer exists.

### Navigation Structure

Minimal Expo Router file layout to support the smoke test:

```
app/
├── _layout.tsx          # Root layout — wraps with NativeWind provider
├── index.tsx            # Entry redirect (placeholder, no auth logic yet)
└── (app)/
    └── index.tsx        # Smoke test screen above
```

`app/_layout.tsx` sets up the bare minimum: NativeWind CSS import and a `<Slot />` or `<Stack />` renderer. No auth gate, no providers beyond what NativeWind requires — those are SPEC-003 and SPEC-004.

---

## 7. Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | `.env` file is missing entirely | `config.ts` startup validation throws: `"Missing .env file or required variable: SUPABASE_URL"` — app does not silently start with `undefined` values |
| 2 | `.env` exists but `SUPABASE_URL` is empty string | Startup validation treats empty string as missing — same error as #1 |
| 3 | Developer runs `npx jest` with no test files | Jest exits with code 0 and prints a "no tests found" message — not a failure exit code |
| 4 | NativeWind `className` is silently ignored (misconfigured babel/metro) | AC-9 catches this — the smoke screen renders unstyled (no centering, no colors), which is a visible failure. The spec-verifier checks for centered layout on all three platforms. |
| 5 | `@` alias works in source but not in Jest | Jest `moduleNameMapper` must mirror `tsconfig.json` paths. AC-5 requires alias resolution in Jest config — a test importing `@/constants/config` must resolve at test time. |
| 6 | Developer runs `eas build` before setting real secrets | Build proceeds using dummy `.env.example` values. The app will crash at runtime when it tries to connect to Supabase — this is expected and acceptable at SPEC-001 stage. Real secrets are set in later specs. |
| 7 | Expo SDK version mismatch with NativeWind v4 | The spec pins the latest stable Expo SDK (as of April 2026). The implementing agent must verify NativeWind v4 compatibility with that SDK version before installing and note the resolved versions in a comment in `package.json`. |

---

## 8. Error Handling

| Error | User-Facing Message | Technical Detail |
|-------|---------------------|------------------|
| Missing env var at startup | App crashes with descriptive error in console | `config.ts` throws `Error("Missing required env var: ${varName}")` — this is intentional fail-fast behavior, not a bug |
| NativeWind fails to load CSS | Smoke screen renders unstyled — white screen, uncentered text | Check: babel plugin `nativewind/babel` present in `babel.config.js`, metro config has NativeWind wrapper, `tailwind.config.js` content paths are correct |
| `npx expo start` fails on web | Metro bundler error in terminal | Likely cause: missing `react-native-web` or `react-dom` — both must be installed as Expo web dependencies |
| Jest fails to resolve `@/` imports | `Cannot find module '@/constants/config'` in test output | `jest.config.js` must include `moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }` |

---

## 9. Dependencies

- **Requires:** None — this is the first spec. No prior specs exist.
- **Blocks:** SPEC-002 (Database Setup), SPEC-003 (Auth), SPEC-004 (Design System Tokens) — all three depend on a working Expo project with the toolchain this spec establishes.
- **Related:** None.

---

## 10. Complexity Estimate

- **Frontend:** M — Expo init is straightforward, but NativeWind v4 configuration has multiple integration points (babel, metro, PostCSS, tailwind config) that require careful wiring.
- **Backend:** N/A — no backend work in this spec.
- **Testing:** S — Jest config only, no test files to write.
- **Total:** M

---

## 11. Testing Strategy

- **Unit tests:** None in this spec. The testing *infrastructure* is set up, but no test files are written. SPEC-002+ will add the first tests.
- **Integration tests:** None.
- **E2E tests:** None. The verification is manual/visual: does the smoke screen render correctly on all three platforms? The spec-verifier can check this by running `npx expo start` and confirming the screen renders.
- **Verification method:** The spec-verifier agent runs the following commands and checks outputs:
  1. `npx tsc --noEmit` — exits 0
  2. `npx jest` — exits 0
  3. `npx expo start --ios` / `--android` / `--web` — smoke screen renders centered "Halvy" text in indigo

---

## 12. Feasibility Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Schema Compatibility | ✅ PASS | No DB work — zero conflict |
| API Compatibility | ✅ PASS | No endpoints — zero conflict |
| Dependency Verification | ✅ PASS | First spec, no dependencies, no circular refs |
| Phase Alignment | ✅ PASS | Maps exactly to Phase 1 Infrastructure block |

**Verdict:** FEASIBLE
**Blockers:** None

---

## 13. Open Questions

- [ ] **OQ-1:** Which exact Expo SDK version is "latest stable" as of April 2026? The implementing agent should resolve this at execution time and record the pinned version in the spec's completion notes. The spec does not hardcode a version number to avoid staleness.
- [ ] **OQ-2:** NativeWind v4 requires a specific metro config wrapper. If the wrapper API has changed between NativeWind releases, the implementing agent should use the version documented at [nativewind.dev](https://nativewind.dev) at execution time and note any deviations from this spec.
