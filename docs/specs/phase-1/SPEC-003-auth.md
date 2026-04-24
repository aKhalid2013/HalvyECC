---
id: SPEC-003
title: "Auth — Supabase Auth, Client Singleton, Auth Gate, Sign-In Screens"
phase: 1
status: approved
priority: P0
complexity: L
created: 2026-04-11
updated: 2026-04-11
depends-on: [SPEC-001, SPEC-002]
branch: feat/SPEC-003-auth
feasibility: passed
---

# SPEC-003: Auth — Supabase Auth, Client Singleton, Auth Gate, Sign-In Screens

## 1. Overview

**Problem:** No authentication exists yet. Every screen is publicly accessible, the Supabase client has no way to identify the current user, and RLS policies (created in SPEC-002) cannot enforce access control without a valid `auth.uid()`. Without auth, no feature — groups, expenses, balances, chat — can function securely.

**Solution:** Configure Supabase Auth with Google OAuth and Magic Link as the Phase 1 sign-in methods (Apple OAuth deferred to Phase 2 — no Apple Developer account yet). Create the Supabase client singleton with a platform-aware secure token storage adapter (SecureStore on native, localStorage on web). Build the auth state management layer (Zustand store + AuthProvider + onAuthStateChange listener). Implement the auth gate in the root layout so unauthenticated users are redirected to sign-in. Create the `auth.users → public.users` sync trigger deferred from SPEC-002. Provide the `users.ts` data-access module for user CRUD. Set up TanStack Query via QueryProvider for downstream data fetching.

**Fits the vision because:** "A chat app with financial intelligence" requires knowing *who* is chatting and *who* owes whom. Identity is the foundation of every balance, every expense attribution, and every group membership. This spec turns Halvy from a static scaffold into a system that recognizes its users.

---

## 2. User Stories

- As a **new user**, I want to sign in with my Google account in one tap, so that I can start using Halvy without creating a password.
- As a **new user**, I want to sign in with a magic link sent to my email, so that I have a passwordless fallback when I prefer not to use Google.
- As a **signed-in user**, I want to stay signed in across app restarts, so that I don't have to re-authenticate every time I open the app.
- As a **signed-in user**, I want to sign out from all devices, so that I can secure my account if a device is lost.
- As a **signed-out user**, I want to be redirected to the sign-in screen automatically, so that I cannot access protected content.
- As a **developer**, I want a Supabase client singleton with secure token storage, so that every API call is authenticated and RLS policies work correctly.
- As a **developer**, I want new `auth.users` rows to automatically create `public.users` rows, so that the application data layer stays in sync with Supabase Auth.
- As a **user who signs in with Google and later with Magic Link using the same email**, I want both methods to resolve to the same account, so that my balance history is not fragmented.

---

## 3. Acceptance Criteria

Each criterion MUST be binary (pass/fail) and testable by the spec-verifier.

### Database — Auth Sync Trigger

- [ ] **AC-1:** `supabase/migrations/00002_auth_sync_trigger.sql` exists and creates a trigger function `fn_auth_sync_user()` and a trigger `trg_auth_sync_user` on `auth.users` that fires AFTER INSERT. The function inserts a row into `public.users` with `id` = `NEW.id`, `email` = `NEW.email`, `display_name` derived from `NEW.raw_user_meta_data->>'full_name'` (falling back to email local part if null), `avatar_url` from `NEW.raw_user_meta_data->>'avatar_url'`, and `auth_provider` derived from `NEW.raw_app_meta_data->>'provider'`.
  - **Oracle:** Runtime oracle — `supabase db reset` exits 0 with both migrations applied. Query `pg_trigger` confirms trigger exists on `auth.users`.

- [ ] **AC-2:** The sync trigger is idempotent — if a `public.users` row with the same `id` already exists (multi-provider merge scenario), the trigger updates `avatar_url` and `display_name` from the new provider metadata instead of failing with a unique constraint violation. Uses `INSERT ... ON CONFLICT (id) DO UPDATE`.
  - **Oracle:** SQL test — insert into `auth.users` twice with same id but different metadata → `public.users` row is updated, no error.

- [ ] **AC-3:** `supabase db reset` applies both `00001_initial_schema.sql` and `00002_auth_sync_trigger.sql` without errors. Seed data from SPEC-002 continues to work (seed inserts directly into `public.users`, bypassing `auth.users` — no conflict).
  - **Oracle:** Runtime oracle — `supabase db reset` exits 0.

### Supabase Client Singleton

- [ ] **AC-4:** `src/api/client.ts` exports a `supabase` singleton created by `createClient()` from `@supabase/supabase-js`. The client is configured with a custom `storage` adapter: on native (iOS/Android), it uses `expo-secure-store` for token persistence; on web, it uses `localStorage` (Supabase default).
  - **Oracle:** Type oracle — `npx tsc --noEmit`. Unit test — mock `Platform.OS` and verify correct storage adapter is selected.

- [ ] **AC-5:** The Supabase client reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the config module (`@/constants/config`). If either value is missing, the app fails at startup (enforced by SPEC-001's config validation).
  - **Oracle:** Type oracle — `npx tsc --noEmit`.

### Auth API Module

- [ ] **AC-6:** `src/api/auth.ts` exports the following functions matching the signatures in api-contracts.md: `signIn(provider: 'google' | 'apple' | 'magic_link', email?: string): Promise<ApiResult<Session>>`, `signOut(): Promise<ApiResult<void>>`, `signOutAllDevices(): Promise<ApiResult<void>>`, `getSession(): Promise<ApiResult<Session | null>>`, `onAuthStateChange(callback: (session: Session | null) => void): Unsubscribe`. All functions use the `supabase` singleton from `client.ts`. All return `ApiResult<T>` (from api-contracts.md error shape).
  - **Oracle:** Type oracle — `npx tsc --noEmit`.

- [ ] **AC-7:** `signIn('google')` triggers `supabase.auth.signInWithOAuth({ provider: 'google' })` with the correct redirect URL for Expo (`expo-auth-session` flow on native, default web flow on web). `signIn('magic_link', email)` triggers `supabase.auth.signInWithOtp({ email })`. `signIn('apple')` returns an `ApiResult` error with code `AUTH_PROVIDER_UNAVAILABLE` and message `"Apple sign-in coming soon"` (deferred to Phase 2).
  - **Oracle:** Unit test — mock `supabase.auth` methods and verify correct delegation.

### Users API Module

- [ ] **AC-8:** `src/api/users.ts` exports: `getUser(userId: string)`, `getCurrentUser()`, `updateUser(userId: string, payload: UpdateUserPayload)`, `deleteUser(userId: string)`, `reactivateUser(userId: string)` — all returning `Promise<ApiResult<User>>` or `Promise<ApiResult<void>>`. All functions use the `supabase` singleton and apply `toCamel()` transformation on responses.
  - **Oracle:** Type oracle — `npx tsc --noEmit`.

- [ ] **AC-9:** `getCurrentUser()` calls `supabase.auth.getUser()` to get the auth user id, then queries `public.users` for that id. If the user's `deleted_at` is non-null, it returns an error with code `USER_DEACTIVATED`.
  - **Oracle:** Unit test — mock Supabase responses and verify behavior for active and deactivated users.

- [ ] **AC-10:** `deleteUser(userId)` performs a soft delete — sets `deleted_at` to `now()` via `supabase.from('users').update({ deleted_at: new Date().toISOString() })`. `reactivateUser(userId)` sets `deleted_at` to `null`. Neither function physically deletes the row.
  - **Oracle:** Unit test — verify SQL operation is an UPDATE, not a DELETE.

### Auth State Store

- [ ] **AC-11:** `src/stores/authStore.ts` exports a Zustand store with the following shape: `{ session: Session | null, user: User | null, isLoading: boolean, isAuthenticated: boolean, error: ApiError | null, setSession: (session) => void, setUser: (user) => void, setLoading: (loading) => void, setError: (error) => void, reset: () => void }`. `isAuthenticated` is a derived getter: `session !== null && user !== null`.
  - **Oracle:** Type oracle — `npx tsc --noEmit`. Unit test — verify store state transitions.

### Auth Provider

- [ ] **AC-12:** `src/providers/AuthProvider.tsx` subscribes to `onAuthStateChange` on mount. When a session is received, it calls `getCurrentUser()` and updates the auth store with both `session` and `user`. When session becomes null, it calls `store.reset()`. While loading, it sets `isLoading: true`. The provider wraps its children and does not render them until initial auth state is resolved (shows nothing or a loading indicator during hydration).
  - **Oracle:** Unit test — mock `onAuthStateChange` and verify store updates. Integration test — verify children are not rendered during hydration.

### Query Provider

- [ ] **AC-13:** `src/providers/QueryProvider.tsx` creates a `QueryClient` with the global config from api-contracts.md (staleTime: 2 minutes, retry: 3, exponential backoff capped at 10s, refetchOnWindowFocus: true) and wraps children in `QueryClientProvider`.
  - **Oracle:** Type oracle — `npx tsc --noEmit`. Unit test — verify QueryClient config values.

### Navigation & Auth Gate

- [ ] **AC-14:** `app/_layout.tsx` wraps the app in this provider order (outermost first): QueryProvider → AuthProvider → NativeWind (from SPEC-001) → Expo Router `<Stack />`. The auth gate logic redirects: if `isLoading` is true, render nothing (or a splash); if `!isAuthenticated`, redirect to `/(auth)/sign-in`; if `isAuthenticated`, render `(app)/` routes.
  - **Oracle:** Type oracle — `npx tsc --noEmit`. Runtime oracle — app launches and shows sign-in screen when no session exists.

- [ ] **AC-15:** `app/index.tsx` redirects to `/(app)/groups` if authenticated, or `/(auth)/sign-in` if not. This is the entry point redirect — it does not render any UI itself.
  - **Oracle:** Type oracle — `npx tsc --noEmit`.

- [ ] **AC-16:** `app/(auth)/_layout.tsx` exists and renders a `<Stack />` navigator for the auth route group. No tab bar is visible on auth screens.
  - **Oracle:** Type oracle — `npx tsc --noEmit`. Runtime oracle — auth screens render without tab bar.

### Sign-In Screen

- [ ] **AC-17:** `app/(auth)/sign-in.tsx` renders three sign-in buttons: "Continue with Google" (functional), "Continue with Apple" (disabled, shows "Coming soon" label), and "Sign in with Magic Link" (navigates to magic link screen or shows email input). Buttons use raw Tailwind classes (no design tokens — SPEC-004 concern). The screen renders correctly on iOS, Android, and web.
  - **Oracle:** Runtime oracle — screen renders all three buttons. Bundle oracle — `npx expo export --platform {ios,android,web}` exits 0.

- [ ] **AC-18:** Tapping "Continue with Google" on a device/simulator opens the Google OAuth consent screen. After granting consent, the user is redirected back to the app, the auth store is populated with session and user, and the user sees the authenticated home screen.
  - **Oracle:** Runtime oracle — Google OAuth flow completes end-to-end on device/simulator.

### Magic Link Screen

- [ ] **AC-19:** `app/(auth)/magic-link.tsx` shows either: (a) an email input field with a "Send Magic Link" button, or (b) a confirmation message ("Check your email for a sign-in link") with a "Resend" button. The screen handles the transition from input → confirmation state. A "Back to sign-in" link returns to the sign-in screen.
  - **Oracle:** Runtime oracle — screen renders and transitions correctly. Bundle oracle — `npx expo export --platform {ios,android,web}` exits 0.

- [ ] **AC-20:** After the user taps the magic link in their email, the app opens (via deep link), the auth store is populated, and the user sees the authenticated home screen. The magic link deep link scheme is registered in `app.config.ts`.
  - **Oracle:** Runtime oracle — magic link flow completes end-to-end.

### Authenticated Home Screen

- [ ] **AC-21:** `app/(app)/index.tsx` (replacing the SPEC-001 smoke test) renders the authenticated user's display name ("Welcome, [name]") and a "Sign Out" button. Tapping "Sign Out" calls `signOut()`, clears the auth store, and redirects to the sign-in screen.
  - **Oracle:** Runtime oracle — screen shows user name and sign-out works. Type oracle — `npx tsc --noEmit`.

### Multi-Provider Merge

- [ ] **AC-22:** When a user signs in with Google (email: x@y.com), signs out, and then signs in with Magic Link using the same email (x@y.com), both sign-ins resolve to the same `public.users` row (same `id`). The session is valid and the user sees the authenticated home screen with their original display name and data intact.
  - **Oracle:** Runtime oracle — manual test on device/simulator with both providers.

### Supabase Auth Configuration

- [ ] **AC-23:** Supabase Auth is configured with Google OAuth enabled (client ID and secret set in Supabase dashboard or `supabase/config.toml`). Magic Link (email OTP) is enabled. Apple OAuth is NOT enabled (deferred to Phase 2). Email confirmation is enabled for all providers.
  - **Oracle:** Runtime oracle — `supabase status` shows Auth running. Supabase dashboard (or config.toml) reflects correct provider configuration.

### Bundle Verification

- [ ] **AC-24:** `npx expo export --platform ios` exits 0.
  - **Oracle:** Bundle oracle.

- [ ] **AC-25:** `npx expo export --platform android` exits 0.
  - **Oracle:** Bundle oracle.

- [ ] **AC-26:** `npx expo export --platform web` exits 0.
  - **Oracle:** Bundle oracle.

### Type Compilation

- [ ] **AC-27:** `npx tsc --noEmit` passes with all new files included.
  - **Oracle:** Type oracle.

### Type Regeneration

- [ ] **AC-28:** `src/types/database.ts` is regenerated after `00002_auth_sync_trigger.sql` is applied (to include the new trigger function types). `npx tsc --noEmit` passes.
  - **Oracle:** Type oracle — regenerate and compile.

---

## 4. Data Model

### New Tables

None. No new tables are created in this spec.

### Modified Tables

None. No table columns are added or changed.

### New Trigger

A new migration file creates the auth sync trigger that was deferred from SPEC-002.

#### `supabase/migrations/00002_auth_sync_trigger.sql`

```sql
-- ============================================================
-- SPEC-003: auth.users → public.users sync trigger
-- Deferred from SPEC-002 because it depends on Supabase Auth
-- being configured and the auth schema being available.
-- ============================================================

-- Trigger function: sync new auth.users rows to public.users
CREATE OR REPLACE FUNCTION fn_auth_sync_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _display_name TEXT;
  _avatar_url   TEXT;
  _provider     TEXT;
BEGIN
  -- Extract display name: prefer full_name from provider metadata,
  -- fall back to email local part
  _display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Extract avatar URL from provider metadata (Google provides 'avatar_url' or 'picture')
  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- Determine auth provider
  _provider := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    'magic_link'
  );

  -- Upsert: INSERT on first sign-up, UPDATE on multi-provider merge
  INSERT INTO public.users (id, email, display_name, avatar_url, auth_provider)
  VALUES (NEW.id, NEW.email, _display_name, _avatar_url, _provider)
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    avatar_url   = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at   = now();

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (fires after insert)
CREATE TRIGGER trg_auth_sync_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION fn_auth_sync_user();
```

**Design notes:**
- `SECURITY DEFINER` is required because the trigger fires in the auth schema context but needs to write to the public schema.
- `SET search_path = public` prevents search path injection.
- `ON CONFLICT (id) DO UPDATE` handles the multi-provider merge case — if Supabase's automatic linking creates the auth row with the same id, the public.users row is updated rather than erroring.
- `COALESCE` on the UPDATE prevents overwriting a good display name with null from a provider that doesn't supply one.

---

## 5. API Contracts

### `src/api/client.ts` — Supabase Client Singleton

```typescript
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { config } from '@/constants/config'
import type { Database } from '@/types/database'

// Platform-aware storage adapter
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient<Database>(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
)
```

### `src/api/auth.ts`

```typescript
signIn(provider: 'google' | 'apple' | 'magic_link', email?: string): Promise<ApiResult<Session>>
signOut(): Promise<ApiResult<void>>
signOutAllDevices(): Promise<ApiResult<void>>
getSession(): Promise<ApiResult<Session | null>>
onAuthStateChange(callback: (session: Session | null) => void): Unsubscribe
```

**Implementation notes:**
- `signIn('google')` uses `supabase.auth.signInWithOAuth({ provider: 'google' })` with Expo AuthSession redirect handling on native.
- `signIn('magic_link', email)` uses `supabase.auth.signInWithOtp({ email })`.
- `signIn('apple')` returns `{ data: null, error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Apple sign-in coming soon' } }`.
- `signOutAllDevices()` uses `supabase.auth.signOut({ scope: 'global' })`.

### `src/api/users.ts`

```typescript
getUser(userId: string): Promise<ApiResult<User>>
getCurrentUser(): Promise<ApiResult<User>>
updateUser(userId: string, payload: UpdateUserPayload): Promise<ApiResult<User>>
deleteUser(userId: string): Promise<ApiResult<void>>
reactivateUser(userId: string): Promise<ApiResult<User>>
```

**Types:**
```typescript
interface UpdateUserPayload {
  displayName?: string
  avatarUrl?:   string | null
}
```

**Implementation notes:**
- All queries target `public.users` (not `auth.users`).
- All responses pass through `toCamel()` from `src/utils/transforms.ts` (defined in api-contracts.md — the implementing agent should create this utility if it does not exist).
- `getCurrentUser()` calls `supabase.auth.getUser()` to get the auth id, then `supabase.from('users').select('*').eq('id', authId).single()`.
- `deleteUser()` sets `deleted_at` to `now()` (soft delete).
- `reactivateUser()` sets `deleted_at` to `null`.
- `getCurrentUser()` checks `deleted_at` — if non-null, returns `{ data: null, error: { code: 'USER_DEACTIVATED', message: 'Account is deactivated' } }`.

**Stale type note:** api-contracts.md defines `User.reliabilityScore` — this field was removed in schema v5.0 and does NOT exist in the `public.users` table. The `User` type in `users.ts` must NOT include `reliabilityScore`. The canonical source is schema.md v5.0 / `src/types/models.ts` from SPEC-002.

---

## 6. UI/UX Specifications

### Screen: Sign-In (`app/(auth)/sign-in.tsx`)

**Layout:**

```
Centered vertically:
  [Halvy logo text — "Halvy" in text-2xl font-bold text-indigo-500]
  [Subtitle — "Split expenses, not friendships" in text-sm text-gray-500]

  Spacer (mt-12)

  [Continue with Google] — full-width button, bg-white border, Google icon
    → Tapping initiates OAuth flow

  [Continue with Apple] — full-width button, bg-gray-100, disabled
    → Shows "Coming soon" secondary text
    → Visually dimmed (opacity-50)

  [Sign in with Magic Link] — full-width button, bg-indigo-500 text-white
    → Navigates to /(auth)/magic-link

  Footer text (mt-8):
    "By continuing, you agree to our Terms of Service"
    (terms link is non-functional in Phase 1 — plain text)
```

**Styling:** Raw Tailwind classes only. No design tokens (`useTheme()`) — that is SPEC-004. Colors are hardcoded anticipating the design system (indigo-500, gray-500, etc.) but are not imported from any token file.

**Error handling:** If Google OAuth fails (network error, user cancels), show a simple `Alert.alert()` with the error message. No custom error UI in Phase 1.

### Screen: Magic Link (`app/(auth)/magic-link.tsx`)

**State 1 — Email input:**
```
[← Back to sign-in] — top-left, text button

Centered:
  "Enter your email"
  [Email text input] — keyboard type "email-address", auto-capitalize none
  [Send Magic Link] — full-width, bg-indigo-500, disabled until email is valid

Error text (if send fails):
  "Failed to send link. Please try again." in text-red-500
```

**State 2 — Confirmation (after successful send):**
```
Centered:
  ✓ checkmark icon (or emoji)
  "Check your email"
  "We sent a sign-in link to [email]" in text-gray-500

  [Resend] — text button, disabled for 60 seconds after send (countdown shown)
  [Back to sign-in] — text button
```

**Transition:** After calling `signIn('magic_link', email)` successfully, switch from State 1 to State 2. The magic link callback (deep link) is handled by Supabase's `onAuthStateChange` listener in AuthProvider — the magic link screen does not need to handle the callback itself.

### Screen: Authenticated Home (`app/(app)/index.tsx`)

Replaces the SPEC-001 smoke test screen.

```
Centered vertically:
  "Welcome, [display_name]" — text-xl font-semibold
  [email] — text-sm text-gray-500

  Spacer (mt-8)

  [Sign Out] — text button, text-red-500
    → Calls signOut()
    → On success: auth store resets, router redirects to /(auth)/sign-in
```

**What this verifies:** Auth state is populated correctly, user data is fetched from `public.users`, sign-out flow works. This screen is temporary and will be replaced by the Groups list screen in Phase 2.

### Navigation Flow

```
App opens
  │
  ├── Session exists → /(app)/index.tsx → "Welcome, [name]"
  │
  └── No session → /(auth)/sign-in
                      │
                      ├── [Google] → OAuth consent → callback → AuthProvider
                      │                                           │
                      │                               populates store → /(app)/
                      │
                      ├── [Apple] → disabled (shows "Coming soon")
                      │
                      └── [Magic Link] → /(auth)/magic-link
                                           │
                                           ├── Enter email → Send OTP
                                           │
                                           └── User taps email link → deep link
                                               → onAuthStateChange fires
                                               → AuthProvider populates store
                                               → /(app)/
```

---

## 7. Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | User cancels Google OAuth consent screen | `signIn` returns error. Sign-in screen shows `Alert.alert()` with "Sign-in cancelled." User remains on sign-in screen. |
| 2 | Google OAuth succeeds but `public.users` sync trigger fails | Extremely unlikely (trigger is `SECURITY DEFINER`). If it happens, `getCurrentUser()` returns error. AuthProvider sets error state. User sees sign-in screen with error. |
| 3 | Magic link email not received (typo in email) | User can tap "Resend" after 60-second cooldown or "Back to sign-in" to try a different email. No error is surfaced from Supabase (OTP sends always succeed from the client's perspective — no email enumeration). |
| 4 | Magic link tapped after 1 hour (expired) | Supabase rejects the token. `onAuthStateChange` does not fire a session. User sees sign-in screen. No explicit error shown (link simply doesn't work). |
| 5 | User signs in with Google, signs out, signs in with Magic Link (same email) | Supabase automatic linking resolves to the same `auth.users` row. Sync trigger fires `ON CONFLICT DO UPDATE` → `public.users` row is updated (not duplicated). User sees same account. |
| 6 | User signs in with Google on two devices simultaneously | Both sessions are valid. `signOutAllDevices()` invalidates all sessions. Refresh token rotation prevents stale sessions from persisting. |
| 7 | App opens with expired access token but valid refresh token | Supabase client `autoRefreshToken: true` silently refreshes. AuthProvider receives new session via `onAuthStateChange`. No user-visible interruption. |
| 8 | App opens with no stored session (first launch) | `getSession()` returns null. AuthProvider sets `isAuthenticated: false`. Router redirects to sign-in. No flash of authenticated content. |
| 9 | `expo-secure-store` is unavailable (rare — old OS version) | `getItemAsync` returns null. Supabase treats session as missing. User must sign in again. No crash. |
| 10 | User has `deleted_at` set (deactivated account) | `getCurrentUser()` returns `USER_DEACTIVATED` error. AuthProvider does not populate `user`. Auth gate redirects to sign-in. In Phase 2+, a reactivation prompt will be shown. |
| 11 | Network offline during sign-in attempt | Google OAuth: system browser shows network error. Magic Link: `signInWithOtp` fails → error message shown. Both are non-fatal. |

---

## 8. Error Handling

| Error | User-Facing Message | Technical Detail |
|-------|---------------------|------------------|
| Google OAuth cancelled by user | "Sign-in cancelled" (Alert) | Supabase returns `{ error: { message: 'User cancelled' } }` |
| Google OAuth network failure | "Network error. Please check your connection and try again." (Alert) | Supabase returns error with network-related message |
| Magic link send failure | "Failed to send link. Please try again." (inline red text) | `signInWithOtp` returns error |
| Magic link expired | No explicit message — link simply doesn't authenticate | Supabase rejects expired token silently |
| Apple sign-in attempted | "Apple sign-in coming soon" (Alert) | Client-side guard returns `AUTH_PROVIDER_UNAVAILABLE` error |
| `getCurrentUser()` fails after auth | "Something went wrong. Please try signing in again." (Alert, then redirect to sign-in) | Auth store `error` is set; AuthProvider clears session |
| User account deactivated | No message in Phase 1 (redirects to sign-in) | `USER_DEACTIVATED` error from `getCurrentUser()`. Reactivation UI is Phase 2+. |
| Session refresh fails | Silent re-authentication — user is redirected to sign-in | `onAuthStateChange` fires with `null` session |

---

## 9. Dependencies

- **Requires:** SPEC-001 (Expo project, NativeWind, Zustand, config module, `.env` setup, directory structure)
- **Requires:** SPEC-002 (Supabase project with `public.users` table, RLS policies, `database.ts` types, `models.ts`)
- **Blocks:** SPEC-004 (Design System Tokens — Phase 1 sequence: 001 → 002 → 003 → 004)
- **Blocks:** All Phase 2+ specs (every feature requires authenticated user context)

### New npm Dependencies

| Package | Purpose | Required By |
|---------|---------|-------------|
| `@supabase/supabase-js` | Supabase client (auth, database, realtime) | `src/api/client.ts` |
| `expo-secure-store` | Secure token storage on native platforms | `src/api/client.ts` |
| `@tanstack/react-query` | Data fetching, caching, optimistic updates | `src/providers/QueryProvider.tsx` |
| `expo-auth-session` | OAuth flow handling on native (redirect management) | `src/api/auth.ts` |
| `expo-web-browser` | Opens system browser for OAuth consent on native | `src/api/auth.ts` |
| `expo-crypto` | Cryptographic utilities required by auth flows | `src/api/auth.ts` |

---

## 10. Manual Setup Prerequisites

The following steps require human action (credentials, dashboard access, or account-level configuration) and **cannot** be performed by the implementing agent. They must be completed before the corresponding acceptance criteria can be tested.

### Required Before Development Begins

| # | Action | Where | Needed For | Notes |
|---|--------|-------|------------|-------|
| 1 | Create a remote Supabase development project (if not already done) | [supabase.com](https://supabase.com) | All runtime ACs | Local Supabase works for migration testing, but OAuth requires a remote project. Also needed for EAS staging builds (Phase 1 exit criteria). |
| 2 | Update `.env` with real Supabase credentials | Local `.env` file | All runtime ACs | Set `SUPABASE_URL=https://<project-ref>.supabase.co` and `SUPABASE_ANON_KEY=<your-anon-key>` |
| 3 | Decide app deep link scheme name | Tell the implementing agent | AC-20 (magic link deep link) | Default is `halvy` (→ `halvy://`). If you prefer a different scheme, communicate it before development starts. |

### Required Before OAuth Testing (AC-18, AC-22)

| # | Action | Where | Needed For | Notes |
|---|--------|-------|------------|-------|
| 4 | Create a Google Cloud project (if not already done) | [Google Cloud Console](https://console.cloud.google.com/) | AC-18, AC-22 | Free tier is sufficient. |
| 5 | Create OAuth 2.0 Client ID (type: Web Application) | Google Cloud Console → APIs & Services → Credentials | AC-18, AC-22 | Add authorized redirect URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback` |
| 6 | Enable Google provider in Supabase Auth | Supabase Dashboard → Authentication → Providers → Google | AC-18, AC-22 | Paste Client ID and Client Secret from step 5. |
| 7 | Set Site URL and Redirect URLs | Supabase Dashboard → Authentication → URL Configuration | AC-18, AC-20, AC-22 | Site URL: your Expo dev URL or app scheme. Add redirect URLs for both web (`http://localhost:8081`) and native (`halvy://`). |

### Required Before Magic Link Testing (AC-20)

| # | Action | Where | Needed For | Notes |
|---|--------|-------|------------|-------|
| 8 | Ensure Email OTP (Magic Link) is enabled | Supabase Dashboard → Authentication → Providers → Email | AC-20 | Enabled by default on new Supabase projects. Verify it's on. |

### NOT Required (Deferred or Unnecessary)

| Action | Why Not Now |
|--------|------------|
| Apple Developer account | Apple OAuth deferred to Phase 2 |
| EAS secrets configuration | Not needed until staging builds at end of Phase 1 |
| Custom email provider (SendGrid, etc.) | Supabase built-in email works for development. Production email is Phase 2+ |
| Domain verification | Not needed for dev/staging |
| Expo EAS project linking | Not needed until first EAS build |

### For the Implementing Agent

The implementing agent should **not** block on these prerequisites. The recommended workflow is:

1. **Start with migration + client code + types + unit tests** — these work against local Supabase (`supabase start`) with no manual setup needed.
2. **Build auth screens + providers + store** — these compile and unit-test without real credentials.
3. **Pause for manual setup** — notify Ahmed that runtime testing (AC-18, AC-20, AC-22) requires the prerequisites above.
4. **Resume with runtime testing** once credentials are configured.

---

## 11. Complexity Estimate

- **Frontend:** M — Auth screens are simple (raw Tailwind), but the AuthProvider + auth gate + Zustand store + routing integration requires careful wiring.
- **Backend:** S — One migration file (sync trigger). Supabase Auth configuration is dashboard/config-only.
- **Testing:** M — Unit tests for auth module, users module, store, and provider. Runtime tests for OAuth + magic link flows.
- **Total:** L

---

## 12. Testing Strategy

### Unit Tests

- **`src/api/auth.ts`** — Mock `supabase.auth` methods. Verify `signIn('google')` delegates to `signInWithOAuth`. Verify `signIn('magic_link', email)` delegates to `signInWithOtp`. Verify `signIn('apple')` returns `AUTH_PROVIDER_UNAVAILABLE`. Verify `signOut` and `signOutAllDevices` call correct Supabase methods.
- **`src/api/users.ts`** — Mock `supabase.from('users')` queries. Verify `getCurrentUser()` returns user for active user. Verify `getCurrentUser()` returns `USER_DEACTIVATED` for deactivated user. Verify `deleteUser()` issues UPDATE with `deleted_at`. Verify `reactivateUser()` issues UPDATE with `deleted_at: null`. Verify `toCamel()` is applied to responses.
- **`src/stores/authStore.ts`** — Verify initial state (`session: null, user: null, isLoading: true`). Verify `setSession` + `setUser` → `isAuthenticated: true`. Verify `reset()` → all fields back to initial. Verify `isAuthenticated` is derived (true only when both session and user are non-null).
- **`src/api/client.ts`** — Mock `Platform.OS`. Verify SecureStore adapter is used on iOS/Android. Verify undefined storage (Supabase default) is used on web.
- **`src/providers/QueryProvider.tsx`** — Verify QueryClient is created with correct config values (staleTime, retry, retryDelay).

### Integration Tests (SQL — run via `supabase test db`)

- **Sync trigger test:** Insert a row into `auth.users` (using `supabase.auth.admin.createUser` or direct SQL as superuser). Verify a corresponding `public.users` row was created with correct `email`, `display_name`, `avatar_url`, and `auth_provider`.
- **Idempotency test:** Insert into `auth.users` with id X. Then update metadata and re-trigger (or insert again with same id via `ON CONFLICT`). Verify `public.users` row was updated, not duplicated.
- **Seed data compatibility:** `supabase db reset` applies both migrations + seed without errors.

### Runtime Tests (Manual — on device/simulator)

- **Google OAuth flow:** Sign-in screen → tap Google → consent screen → redirect → authenticated home with display name.
- **Magic link flow:** Sign-in screen → tap Magic Link → enter email → receive email → tap link → authenticated home.
- **Sign-out flow:** Authenticated home → tap Sign Out → redirected to sign-in screen. Reopening app shows sign-in (session cleared).
- **Auth gate:** Direct navigation to `/(app)/` while signed out → redirected to sign-in.
- **Multi-provider merge:** Sign in with Google → sign out → sign in with Magic Link (same email) → same user, same display name.

### Compilation & Bundle Tests

- `npx tsc --noEmit` passes with all new files.
- `npx expo export --platform ios` exits 0.
- `npx expo export --platform android` exits 0.
- `npx expo export --platform web` exits 0.

---

## 13. Feasibility Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Schema Compatibility | ✅ PASS | No new tables. One new trigger on `auth.users` → writes to existing `public.users` via `ON CONFLICT (id) DO UPDATE`. No column additions. Compatible with SPEC-002's 00001 migration. |
| API Compatibility | ✅ PASS | `auth.ts` and `users.ts` match api-contracts.md signatures. `reliabilityScore` explicitly excluded (stale in api-contracts.md, removed in schema v5.0). `ApiResult<T>`, `toCamel()`, QueryClient config all follow api-contracts.md conventions. No endpoint conflicts. |
| Dependency Verification | ✅ PASS | SPEC-001 is ✔️ verified. SPEC-002 is ✔️ verified. All 6 new npm packages (`@supabase/supabase-js`, `expo-secure-store`, `@tanstack/react-query`, `expo-auth-session`, `expo-web-browser`, `expo-crypto`) are actively maintained, Expo managed workflow compatible, no conflicts. No circular dependencies. |
| Phase Alignment | ✅ PASS | All 13 deliverables match Phase 1 → Auth checklist in phasing-strategy.md. Apple OAuth deferral documented — Phase 1 exit criteria only requires Google OAuth + Magic Link. Dependency chain SPEC-001 → 002 → 003 → 004 respected. |
| Oracle Coverage | ✅ PASS | 28/28 ACs have automated oracles. AC-17, AC-19, AC-24–26 use bundle oracle (mandatory — spec adds npm deps + modifies app.config.ts). AC-18, AC-20, AC-22 are runtime-only (justified — OAuth/magic-link flows require real browser + auth service). No AC relies solely on visual confirmation. |

**Verdict:** FEASIBLE
**Blockers:** None

---

## 14. Open Questions

All resolved during brainstorming. No open questions remain.

| # | Question | Resolution |
|---|----------|------------|
| 1 | Sign-in screen styling? | Raw Tailwind (Option A). No design tokens — SPEC-004 concern. |
| 2 | `users.ts` in this spec or deferred? | Include — thin wrapper, type+unit testable. |
| 3 | Multi-provider email merge behavior? | Rely on Supabase automatic linking. Sync trigger uses `ON CONFLICT DO UPDATE` for idempotency. |
| 4 | What happens to SPEC-001 smoke test? | Replaced with auth-gated home ("Welcome, [name]" + sign out). |
| 5 | Migration file: new or append? | New file: `00002_auth_sync_trigger.sql`. Respects spec boundary. |
| 6 | Token storage on web? | Platform-aware shim — SecureStore on native, localStorage (Supabase default) on web. |
| 7 | QueryProvider scope? | Include in SPEC-003. ~20-line file, unblocks Phase 2 hooks. |
| 8 | Apple OAuth in Phase 1? | Deferred to Phase 2. Button present but disabled with "Coming soon." |
| 9 | `reliabilityScore` on User type? | Excluded. Stale in api-contracts.md — removed in schema v5.0. Canonical source is schema.md / models.ts. |

---

## Appendix A: Oracle Coverage Matrix

Every AC must map to at least one automated oracle. No AC relies solely on manual/visual confirmation.

| AC | Oracle Layer(s) | Method |
|----|----------------|--------|
| AC-1 | Runtime | `supabase db reset` exits 0 + `pg_trigger` query |
| AC-2 | Runtime | SQL test — duplicate id insert, verify update |
| AC-3 | Runtime | `supabase db reset` exits 0 |
| AC-4 | Type + Test | `npx tsc --noEmit` + unit test (Platform.OS mock) |
| AC-5 | Type | `npx tsc --noEmit` |
| AC-6 | Type | `npx tsc --noEmit` |
| AC-7 | Test | Unit test — mock supabase.auth, verify delegation |
| AC-8 | Type | `npx tsc --noEmit` |
| AC-9 | Test | Unit test — mock responses for active/deactivated user |
| AC-10 | Test | Unit test — verify UPDATE operation, not DELETE |
| AC-11 | Type + Test | `npx tsc --noEmit` + unit test (store transitions) |
| AC-12 | Test | Unit test — mock onAuthStateChange, verify store |
| AC-13 | Type + Test | `npx tsc --noEmit` + unit test (QueryClient config) |
| AC-14 | Type + Runtime | `npx tsc --noEmit` + app launch shows sign-in |
| AC-15 | Type | `npx tsc --noEmit` |
| AC-16 | Type + Runtime | `npx tsc --noEmit` + auth screens render without tab bar |
| AC-17 | Runtime + Bundle | Screen renders 3 buttons + `npx expo export` exits 0 |
| AC-18 | Runtime | Google OAuth end-to-end on device |
| AC-19 | Runtime + Bundle | Screen renders + transitions + `npx expo export` exits 0 |
| AC-20 | Runtime | Magic link end-to-end on device |
| AC-21 | Runtime + Type | Screen shows name + sign-out works + `npx tsc --noEmit` |
| AC-22 | Runtime | Multi-provider test on device |
| AC-23 | Runtime | `supabase status` + provider config check |
| AC-24 | Bundle | `npx expo export --platform ios` exits 0 |
| AC-25 | Bundle | `npx expo export --platform android` exits 0 |
| AC-26 | Bundle | `npx expo export --platform web` exits 0 |
| AC-27 | Type | `npx tsc --noEmit` |
| AC-28 | Type | Regenerate types + `npx tsc --noEmit` |

**Gap analysis:** AC-18, AC-20, and AC-22 rely on runtime oracle only (device/simulator). These test end-to-end OAuth and magic link flows which inherently require a running auth service and a real browser — no automated alternative exists for these. All other ACs have type, test, or bundle oracles. This is the minimum viable set of runtime-only ACs for an auth spec.

---

## Appendix B: File Inventory

All files created or modified by this spec:

| Action | Path | Description |
|--------|------|-------------|
| Create | `supabase/migrations/00002_auth_sync_trigger.sql` | Auth sync trigger |
| Create | `src/api/client.ts` | Supabase singleton with SecureStore adapter |
| Create | `src/api/auth.ts` | Auth API module |
| Create | `src/api/users.ts` | Users CRUD module |
| Create | `src/utils/transforms.ts` | `toCamel()` utility (from api-contracts.md) |
| Create | `src/stores/authStore.ts` | Zustand auth store |
| Create | `src/providers/AuthProvider.tsx` | Auth state provider |
| Create | `src/providers/QueryProvider.tsx` | TanStack Query provider |
| Create | `app/(auth)/_layout.tsx` | Auth route group layout |
| Create | `app/(auth)/sign-in.tsx` | Sign-in screen |
| Create | `app/(auth)/magic-link.tsx` | Magic link screen |
| Modify | `app/_layout.tsx` | Add AuthProvider, QueryProvider, auth gate |
| Modify | `app/index.tsx` | Entry redirect (session check) |
| Modify | `app/(app)/index.tsx` | Replace smoke test with authenticated home |
| Modify | `app.config.ts` | Add OAuth scheme for deep link handling |
| Modify | `package.json` | Add 6 new dependencies |
| Regenerate | `src/types/database.ts` | Regenerate after new migration |
| Modify | `supabase/MIGRATION_LOG.md` | Add entry for `00002_auth_sync_trigger.sql` |
