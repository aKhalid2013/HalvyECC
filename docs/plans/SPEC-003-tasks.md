# SPEC-003 Task List — Auth — Supabase Auth, Client Singleton, Auth Gate, Sign-In Screens
Status: ⏳ PENDING APPROVAL
Spec: docs/specs/phase-1/SPEC-003-auth.md

## Overview
This spec builds the complete authentication layer on top of the SPEC-001/002 foundation.
It creates the `auth.users → public.users` sync trigger, the Supabase client singleton
with platform-aware secure token storage, the auth and users API modules, a Zustand
auth store, AuthProvider, QueryProvider, an auth gate in the root layout, and all three
auth-related screens (sign-in, magic-link, authenticated home). When all 8 tasks are
done, users can sign in with Google OAuth or Magic Link, stay signed in across restarts,
sign out, and be redirected correctly based on their auth state.

## Prerequisites
- [ ] `feat/SPEC-003-auth` branch created from the verified SPEC-002 branch
- [ ] SPEC-001 and SPEC-002 verified and merged (public.users table exists, config module exists)
- [ ] npm dependencies installed:
  ```
  npm install @supabase/supabase-js expo-secure-store @tanstack/react-query expo-auth-session expo-web-browser expo-crypto
  ```
- [ ] Local Supabase running (`supabase start`) — required for TASK-1 migration testing
- [ ] `.env` populated with `SUPABASE_URL` and `SUPABASE_ANON_KEY` — required for runtime ACs
  (runtime ACs AC-18, AC-20, AC-22 can be deferred; all other tasks compile without real credentials)

## Testing Layers

| Layer | Tool | Command | Runnable from |
|---|---|---|---|
| Unit | Jest + React Native Testing Library | `npm run test` | Per task (any time) |
| Integration (SQL) | supabase test db | `npm run test:integration` | TASK-1 onwards (needs `supabase start`) |
| Web E2E | Playwright | `npm run test:web-e2e` | After TASK-8 (full auth UI exists) |
| Mobile E2E | Maestro | `maestro test` | After TASK-8 (full auth UI exists) |

## Approval Checklist
- [ ] Task decomposition is correct
- [ ] Task order respects dependencies
- [ ] Scope matches the spec exactly
- [ ] Each task is self-contained (passes Rule T3)
- [ ] Each task has Steps and Done When sections
- [ ] Ready to begin with TASK-1

---

## TASK-1: Create auth sync trigger migration
Status: ⬜ not started
Estimated effort: M
Acceptance Criteria Covered: AC-1, AC-2, AC-3, AC-28

### Context
SPEC-002 established the `public.users` table but deferred the trigger that syncs new
`auth.users` rows into `public.users` on sign-up. This task creates that trigger as a
new migration. The existing migrations are `00001_initial_schema.sql`,
`00002_copilot_review_fixes.sql`, and `00003_copilot_review_fixes_2.sql` — so the new
file must be named `00004_auth_sync_trigger.sql` (the spec references `00002` but that
filename is already taken). The trigger function uses `SECURITY DEFINER` and
`SET search_path = public` for safety, and `ON CONFLICT (id) DO UPDATE` for idempotent
multi-provider merge. After applying locally, regenerate `src/types/database.ts`.

### Files
- CREATE: `supabase/migrations/00004_auth_sync_trigger.sql`
- MODIFY: `supabase/MIGRATION_LOG.md`
- MODIFY: `src/types/database.ts` (regenerate after migration applied)

### Testing — Integration (SQL)
Run after `supabase db reset` confirms all four migrations + seed apply cleanly:
- Query `pg_trigger` to confirm `trg_auth_sync_user` exists on `auth.users`.
- SQL insert into `auth.users` with `raw_user_meta_data` containing `full_name` →
  verify `public.users` row has correct `display_name`, `avatar_url`, `auth_provider`.
- SQL insert with no `full_name` → verify fallback to email local part (`SPLIT_PART(email, '@', 1)`).
- SQL idempotency: insert same `id` twice with different metadata → `public.users` row
  updated, no unique constraint error.
- `supabase db reset` with seed → no errors (seed inserts directly into `public.users`,
  bypassing `auth.users`).

### Steps
1. Create `supabase/migrations/00004_auth_sync_trigger.sql`.
2. Write trigger function `fn_auth_sync_user()` with:
   - `RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
   - Extract `_display_name`: `COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1))`
   - Extract `_avatar_url`: `COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')`
   - Extract `_provider`: `COALESCE(NEW.raw_app_meta_data->>'provider', 'magic_link')`
   - `INSERT INTO public.users (id, email, display_name, avatar_url, auth_provider) VALUES (...) ON CONFLICT (id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, users.display_name), avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url), updated_at = now()`
   - `RETURN NEW`
3. Attach the trigger: `CREATE TRIGGER trg_auth_sync_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION fn_auth_sync_user();`
4. Include a `-- DOWN` rollback comment: `DROP TRIGGER IF EXISTS trg_auth_sync_user ON auth.users; DROP FUNCTION IF EXISTS fn_auth_sync_user();`
5. Run `supabase db reset` to verify all four migrations + seed apply without errors.
6. Verify: `SELECT count(*) FROM information_schema.triggers WHERE trigger_name = 'trg_auth_sync_user';` returns 1.
7. Add entry for `00004_auth_sync_trigger.sql` to `supabase/MIGRATION_LOG.md` (date, description, DOWN rollback).
8. Regenerate types: `npx supabase gen types typescript --local > src/types/database.ts`
9. Run `npx tsc --noEmit` to confirm regenerated types compile.

### Done When
- [ ] `supabase/migrations/00004_auth_sync_trigger.sql` exists with `fn_auth_sync_user()` and `trg_auth_sync_user`
- [ ] `supabase db reset` exits 0 (all four migrations + seed)
- [ ] `SELECT count(*) FROM information_schema.triggers WHERE trigger_name = 'trg_auth_sync_user'` returns 1
- [ ] SQL test: insert into `auth.users` → correct `public.users` row created
- [ ] SQL test: duplicate insert → row updated, no constraint error
- [ ] `supabase/MIGRATION_LOG.md` updated with `00004` entry and DOWN rollback
- [ ] `src/types/database.ts` regenerated
- [ ] `npx tsc --noEmit` passes

### Start command
/tdd TASK-1 SPEC-003

---

## TASK-2: Supabase client singleton and toCamel utility
Status: ⬜ not started
Depends on: TASK-1
Estimated effort: S
Acceptance Criteria Covered: AC-4, AC-5

### Context
This task creates two foundational modules that every subsequent API module depends on.
`src/api/client.ts` exports the Supabase singleton with a platform-aware storage
adapter: on iOS/Android it uses `expo-secure-store` (`getItemAsync`, `setItemAsync`,
`deleteItemAsync`); on web it passes `storage: undefined` (Supabase default /
localStorage). The client reads `config.supabaseUrl` and `config.supabaseAnonKey` from
`src/constants/config.ts` — startup validation is already enforced there. The `Database`
type lives at `src/types/database.ts` (regenerated in TASK-1). `src/utils/transforms.ts`
exports `toCamel<T>()`, which recursively converts snake_case database response objects
to camelCase — used by every API module. All six npm dependencies must be installed
before this task (see Prerequisites).

### Files
- CREATE: `src/api/client.ts`
- CREATE: `src/utils/transforms.ts`
- CREATE: `src/api/__tests__/client.test.ts`
- CREATE: `src/utils/__tests__/transforms.test.ts`

### Testing — Unit (Jest)
- Mock `Platform.OS = 'ios'` → `ExpoSecureStoreAdapter` is passed as `storage`.
- Mock `Platform.OS = 'android'` → `ExpoSecureStoreAdapter` is passed as `storage`.
- Mock `Platform.OS = 'web'` → `storage` is `undefined`.
- `toCamel({ created_at: 'x', display_name: 'Y' })` → `{ createdAt: 'x', displayName: 'Y' }`.
- `toCamel()` recurses into nested objects.
- `toCamel()` does not mutate the input — original object unchanged.
- Arrays pass through without snake_case conversion on elements.

### Steps
1. Create `src/utils/transforms.ts`. Implement `toCamel<T>()` using `Object.fromEntries` + `Object.entries` — map keys with `.replace(/_([a-z])/g, (_, c) => c.toUpperCase())`, recurse on plain objects. Exact implementation is in api-contracts.md `## General Conventions`.
2. Create `src/utils/__tests__/transforms.test.ts` and write all unit tests listed above. Run `npm run test` — tests should fail initially.
3. Confirm `toCamel` implementation makes tests pass.
4. Create `src/api/client.ts`:
   - Import `createClient` from `@supabase/supabase-js`
   - Import `Platform` from `react-native`
   - Import `* as SecureStore` from `expo-secure-store`
   - Import `config` from `@/constants/config`
   - Import `Database` type from `@/types/database`
   - Define `ExpoSecureStoreAdapter = { getItem: (key) => SecureStore.getItemAsync(key), setItem: (key, value) => SecureStore.setItemAsync(key, value), removeItem: (key) => SecureStore.deleteItemAsync(key) }`
   - Export `supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, { auth: { storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' } })`
5. Create `src/api/__tests__/client.test.ts` and write storage adapter unit tests. Mock `react-native`'s `Platform` and `expo-secure-store`.
6. Run `npm run test` — all tests pass.
7. Run `npx tsc --noEmit` — no errors.

### Done When
- [ ] `src/utils/transforms.ts` exports `toCamel()`
- [ ] `src/api/client.ts` exports `supabase` singleton
- [ ] Unit test: `Platform.OS='ios'` → SecureStore adapter used
- [ ] Unit test: `Platform.OS='web'` → storage is undefined
- [ ] Unit test: `toCamel()` converts and recurses correctly, no mutation
- [ ] `npm run test` passes
- [ ] `npx tsc --noEmit` passes

### Start command
/tdd TASK-2 SPEC-003

---

## TASK-3: Auth API module
Status: ⬜ not started
Depends on: TASK-2
Estimated effort: S
Acceptance Criteria Covered: AC-6, AC-7

### Context
This task creates `src/api/auth.ts`, the single module through which all authentication
flows pass. It uses the `supabase` singleton from `src/api/client.ts` (TASK-2). The
module exports five functions matching the api-contracts.md signatures exactly. Define
`ApiResult<T>`, `ApiError`, and `Unsubscribe` types here or in a shared
`src/types/api.ts` — whichever you choose, they must be importable by other modules.
`signIn('apple')` is a client-side guard that returns `AUTH_PROVIDER_UNAVAILABLE`
without calling Supabase (Apple OAuth is deferred to Phase 2). `signOutAllDevices()`
uses `supabase.auth.signOut({ scope: 'global' })`. All functions wrap Supabase calls
in try/catch and return `ApiResult<T>` — never throw.

### Files
- CREATE: `src/api/auth.ts`
- CREATE: `src/api/__tests__/auth.test.ts`

### Testing — Unit (Jest)
Mock `supabase.auth` methods via `jest.mock('@/api/client')`:
- `signIn('google')` → `supabase.auth.signInWithOAuth` called with `{ provider: 'google' }`.
- `signIn('magic_link', 'x@y.com')` → `supabase.auth.signInWithOtp` called with `{ email: 'x@y.com' }`.
- `signIn('apple')` → returns `{ data: null, error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Apple sign-in coming soon' } }` and makes NO Supabase call.
- `signOut()` → `supabase.auth.signOut()` called with no args.
- `signOutAllDevices()` → `supabase.auth.signOut({ scope: 'global' })` called.
- `onAuthStateChange(cb)` → subscribes and returns an unsubscribe function (callable).
- Supabase error → function returns `{ data: null, error: { code: '...', message: '...' } }`.

### Steps
1. Decide where `ApiResult<T>`, `ApiError`, `Unsubscribe` live — either top of `auth.ts`
   or a new `src/types/api.ts`. If creating `src/types/api.ts`, create it now.
2. Create `src/api/__tests__/auth.test.ts` with all unit tests listed above. Run — tests fail (RED).
3. Create `src/api/auth.ts`:
   - Import `supabase` from `@/api/client`
   - Import `Session` from `@supabase/supabase-js`
   - Implement `signIn(provider, email?)`: switch on provider — `'google'` → `supabase.auth.signInWithOAuth({ provider: 'google' })`, `'magic_link'` → `supabase.auth.signInWithOtp({ email: email! })`, `'apple'` → return `{ data: null, error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Apple sign-in coming soon' } }` immediately
   - Implement `signOut()`: `supabase.auth.signOut()`
   - Implement `signOutAllDevices()`: `supabase.auth.signOut({ scope: 'global' })`
   - Implement `getSession()`: `supabase.auth.getSession()` — return `session` from result
   - Implement `onAuthStateChange(callback)`: `supabase.auth.onAuthStateChange((_, session) => callback(session))` — return `() => subscription.unsubscribe()`
   - Wrap all Supabase calls in try/catch — return `{ data: null, error: { code: 'UNKNOWN', message: err.message } }` on error
4. Run `npm run test` — all tests pass (GREEN).
5. Run `npx tsc --noEmit` — no errors.

### Done When
- [ ] `src/api/auth.ts` exports `signIn`, `signOut`, `signOutAllDevices`, `getSession`, `onAuthStateChange`
- [ ] `ApiResult<T>`, `ApiError`, `Unsubscribe` types defined and importable
- [ ] Unit test: `signIn('apple')` returns `AUTH_PROVIDER_UNAVAILABLE`, no Supabase call made
- [ ] Unit test: `signIn('google')` delegates to `signInWithOAuth`
- [ ] Unit test: `signIn('magic_link', email)` delegates to `signInWithOtp`
- [ ] Unit test: `signOutAllDevices()` calls `signOut({ scope: 'global' })`
- [ ] `npm run test` passes
- [ ] `npx tsc --noEmit` passes

### Start command
/tdd TASK-3 SPEC-003

---

## TASK-4: Users API module
Status: ⬜ not started
Depends on: TASK-2
Estimated effort: S
Acceptance Criteria Covered: AC-8, AC-9, AC-10

### Context
This task creates `src/api/users.ts`, the CRUD module for `public.users`. It uses
the `supabase` singleton from `src/api/client.ts` and `toCamel()` from
`src/utils/transforms.ts` (both from TASK-2). All responses pass through `toCamel()`.
`getCurrentUser()` calls `supabase.auth.getUser()` for the auth id, then queries
`public.users` — if `deleted_at` is non-null it returns a `USER_DEACTIVATED` error
without returning the user row. `deleteUser()` is a soft delete (UPDATE `deleted_at`).
`reactivateUser()` sets `deleted_at` to null. The `User` type comes from
`src/types/models.ts` — it does NOT include `reliabilityScore` (removed in schema
v5.0). `UpdateUserPayload` has optional `displayName?: string` and
`avatarUrl?: string | null`. Import `ApiResult` and `ApiError` from wherever TASK-3
defined them.

### Files
- CREATE: `src/api/users.ts`
- CREATE: `src/api/__tests__/users.test.ts`

### Testing — Unit (Jest)
Mock `supabase.auth.getUser()` and `supabase.from('users')` via `jest.mock('@/api/client')`:
- `getCurrentUser()` → active user (`deleted_at: null`) → returns `{ data: User, error: null }` with camelCase fields.
- `getCurrentUser()` → deleted user (`deleted_at` non-null) → returns `{ data: null, error: { code: 'USER_DEACTIVATED' } }`.
- `deleteUser(id)` → issues `UPDATE` with `{ deleted_at: <iso-string> }` — does NOT call `.delete()`.
- `reactivateUser(id)` → issues `UPDATE` with `{ deleted_at: null }`.
- `updateUser(id, { displayName: 'X' })` → issues `UPDATE` with `{ display_name: 'X' }` (snake_case for DB).
- `toCamel()` applied to all responses — output has camelCase keys.

### Steps
1. Create `src/api/__tests__/users.test.ts` with all unit tests listed above. Run — tests fail (RED).
2. Create `src/api/users.ts`:
   - Import `supabase` from `@/api/client`, `toCamel` from `@/utils/transforms`, `User` from `@/types/models`, `ApiResult` from wherever TASK-3 defined it
   - Implement `getCurrentUser()`: `supabase.auth.getUser()` → extract `id` → `supabase.from('users').select('*').eq('id', id).single()` → if `data.deleted_at` non-null return `USER_DEACTIVATED` error → else return `{ data: toCamel(data), error: null }`
   - Implement `getUser(userId)`: `supabase.from('users').select('*').eq('id', userId).single()` → `toCamel()`
   - Implement `updateUser(userId, payload)`: convert `payload` keys to snake_case manually (`displayName → display_name`, `avatarUrl → avatar_url`) → `supabase.from('users').update(snakePayload).eq('id', userId).select().single()` → `toCamel()`
   - Implement `deleteUser(userId)`: `supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', userId)`
   - Implement `reactivateUser(userId)`: `supabase.from('users').update({ deleted_at: null }).eq('id', userId).select().single()` → `toCamel()`
   - Wrap all in try/catch, return `ApiResult<T>`
3. Run `npm run test` — all tests pass (GREEN).
4. Run `npx tsc --noEmit` — no errors.

### Done When
- [ ] `src/api/users.ts` exports `getUser`, `getCurrentUser`, `updateUser`, `deleteUser`, `reactivateUser`
- [ ] Unit test: `getCurrentUser()` active → User returned with camelCase fields
- [ ] Unit test: `getCurrentUser()` deleted → `USER_DEACTIVATED` error
- [ ] Unit test: `deleteUser()` issues UPDATE with `deleted_at`, not `.delete()`
- [ ] Unit test: `reactivateUser()` issues UPDATE with `deleted_at: null`
- [ ] `npm run test` passes
- [ ] `npx tsc --noEmit` passes

### Start command
/tdd TASK-4 SPEC-003

---

## TASK-5: Auth Zustand store
Status: ⬜ not started
Depends on: TASK-3
Estimated effort: S
Acceptance Criteria Covered: AC-11

### Context
This task creates `src/stores/authStore.ts`, the Zustand store that holds
authentication state for the entire app. `AuthProvider` (TASK-6) writes to this store;
screens read from it via the exported `useAuthStore` hook. Store shape: `session`
(`Session | null` from `@supabase/supabase-js`), `user` (`User | null` from
`src/types/models.ts`), `isLoading` (`boolean`), `isAuthenticated` (derived: `true`
only when both `session !== null` AND `user !== null`), `error` (`ApiError | null`),
and setters `setSession`, `setUser`, `setLoading`, `setError`, `reset`. Initial state:
`session: null`, `user: null`, `isLoading: true`, `isAuthenticated: false`,
`error: null`. `reset()` restores all fields to initial state including `isLoading: true`
— this ensures the auth gate re-enters loading state on sign-out rather than flashing
unauthenticated content.

### Files
- CREATE: `src/stores/authStore.ts`
- CREATE: `src/stores/__tests__/authStore.test.ts`

### Testing — Unit (Jest)
- Initial state: `session: null, user: null, isLoading: true, isAuthenticated: false, error: null`.
- `setSession(s) + setUser(u)` → `isAuthenticated: true`.
- `setSession(s)` alone (user null) → `isAuthenticated: false`.
- `setUser(u)` alone (session null) → `isAuthenticated: false`.
- `setLoading(false)` → `isLoading: false`.
- `setError({ code: 'X', message: 'Y' })` → `error` set correctly.
- `reset()` → all fields return to initial state; `isLoading: true`.
- State updates are immutable — previous state object not mutated.

### Steps
1. Create `src/stores/__tests__/authStore.test.ts` with all unit tests above. Run — fail (RED).
2. Create `src/stores/authStore.ts`:
   - Import `create` from `zustand`, `Session` from `@supabase/supabase-js`, `User` from `@/types/models`, `ApiError` from wherever TASK-3 defined it
   - Define `AuthState` interface with all fields and setters
   - Define `initialState` object: `{ session: null, user: null, isLoading: true, error: null }`
   - Create store: `export const useAuthStore = create<AuthState>((set, get) => ({ ...initialState, get isAuthenticated() { return get().session !== null && get().user !== null }, setSession: (session) => set({ session }), setUser: (user) => set({ user }), setLoading: (isLoading) => set({ isLoading }), setError: (error) => set({ error }), reset: () => set(initialState) }))`
   - Export `useAuthStore`
3. Run `npm run test` — all tests pass (GREEN).
4. Run `npx tsc --noEmit` — no errors.

### Done When
- [ ] `src/stores/authStore.ts` exports `useAuthStore`
- [ ] Initial state: `isLoading: true`, all others null/false
- [ ] `setSession + setUser` → `isAuthenticated: true`
- [ ] Either null alone → `isAuthenticated: false`
- [ ] `reset()` → restores `isLoading: true` and all nulls
- [ ] `npm run test` passes
- [ ] `npx tsc --noEmit` passes

### Start command
/tdd TASK-5 SPEC-003

---

## TASK-6: AuthProvider
Status: ⬜ not started
Depends on: TASK-3, TASK-4, TASK-5
Estimated effort: M
Acceptance Criteria Covered: AC-12

### Context
This task creates `src/providers/AuthProvider.tsx`, which bridges Supabase Auth state
into the Zustand auth store. On mount it subscribes to `onAuthStateChange` (from
`src/api/auth.ts`, TASK-3). When a session arrives: calls `getCurrentUser()` (from
`src/api/users.ts`, TASK-4), then updates the store (TASK-5) with `setSession`,
`setUser`, and `setLoading(false)`. If `getCurrentUser()` returns an error (e.g.
`USER_DEACTIVATED`), calls `setError(error)` and `setLoading(false)` without setting
user. When session becomes null: calls `store.reset()`. While `isLoading: true` the
provider renders `null` — no children flash before session resolves. The unsubscribe
function returned by `onAuthStateChange` is called on unmount via `useEffect` cleanup.

### Files
- CREATE: `src/providers/AuthProvider.tsx`
- CREATE: `src/providers/__tests__/AuthProvider.test.tsx`

### Testing — Unit (Jest + RNTL)
Mock `onAuthStateChange`, `getCurrentUser`, and `useAuthStore`:
- `onAuthStateChange` fires with session → `setSession`, `setUser`, `setLoading(false)` called in correct order.
- `onAuthStateChange` fires with session but `getCurrentUser()` returns `USER_DEACTIVATED` → `setError` called, `setUser` NOT called, `setLoading(false)` called.
- `onAuthStateChange` fires with null → `reset()` called.
- `isLoading: true` → RNTL `queryByText('child')` returns null (children not rendered).
- `isLoading: false` → children rendered.
- Component unmounts → the unsubscribe function returned by `onAuthStateChange` is called.

### Steps
1. Create `src/providers/__tests__/AuthProvider.test.tsx` with all tests above. Run — fail (RED).
2. Create `src/providers/AuthProvider.tsx`:
   - Import `onAuthStateChange` from `@/api/auth`, `getCurrentUser` from `@/api/users`, `useAuthStore` from `@/stores/authStore`
   - In `useEffect`: call `onAuthStateChange` with async callback — store unsubscribe in a `ref` or `let` variable
   - Callback receives `session`: if `session !== null` → call `getCurrentUser()` → on success call `setSession(session), setUser(user), setLoading(false)` → on error call `setError(error), setLoading(false)`; if `session === null` → call `reset()`
   - Cleanup: return `() => unsubscribe()`
   - Render: read `isLoading` from `useAuthStore` — if `true` return `null`; else render `{children}`
3. Run `npm run test` — all tests pass (GREEN).
4. Run `npx tsc --noEmit` — no errors.

### Done When
- [ ] `src/providers/AuthProvider.tsx` exists
- [ ] Unit test: session received → `setSession`, `setUser`, `setLoading(false)` called
- [ ] Unit test: `USER_DEACTIVATED` → `setError` called, `setUser` not called
- [ ] Unit test: session null → `reset()` called
- [ ] Unit test: `isLoading: true` → children not rendered
- [ ] Unit test: unmount → unsubscribe called
- [ ] `npm run test` passes
- [ ] `npx tsc --noEmit` passes

### Start command
/tdd TASK-6 SPEC-003

---

## TASK-7: Root layout, auth gate, QueryProvider, entry redirect, auth route layout
Status: ⬜ not started
Depends on: TASK-5, TASK-6
Estimated effort: M
Acceptance Criteria Covered: AC-13, AC-14, AC-15, AC-16

### Context
This task wires all providers into the app shell and implements the auth gate. It also
creates QueryProvider — small enough (~20 lines) to do in the same session as the
layout that mounts it. `src/providers/QueryProvider.tsx` creates a `QueryClient` with
the api-contracts.md config (`staleTime: 120000`, `retry: 3`, exponential backoff
capped at 10 s, `refetchOnWindowFocus: true`) and wraps children in `QueryClientProvider`.
`app/_layout.tsx` (currently `<Slot />`) is rewritten: provider order is QueryProvider
→ AuthProvider (TASK-6) → Expo Router `<Stack />`. The auth gate reads `isLoading`
and `isAuthenticated` from `useAuthStore` (TASK-5): if `isLoading` render null; if
`!isAuthenticated` redirect to `/(auth)/sign-in`; otherwise render the stack.
`app/index.tsx` currently redirects blindly to `/(app)` — update it to check auth
state and redirect to `/(app)/groups` or `/(auth)/sign-in`. `app/(auth)/_layout.tsx`
renders a `<Stack />` for the auth route group — no tab bar.

### Files
- CREATE: `src/providers/QueryProvider.tsx`
- CREATE: `src/providers/__tests__/QueryProvider.test.tsx`
- MODIFY: `app/_layout.tsx`
- MODIFY: `app/index.tsx`
- CREATE: `app/(auth)/_layout.tsx`

### Testing — Unit (Jest + RNTL)
QueryProvider:
- `defaultOptions.queries.staleTime === 120000`.
- `defaultOptions.queries.retry === 3`.
- `retryDelay(0)` returns 1000, `retryDelay(1)` returns 2000, `retryDelay(10)` capped at 10000.

Auth gate (mock `useAuthStore`):
- `isLoading: true` → renders null (no redirect, no children).
- `isLoading: false, isAuthenticated: false` → `<Redirect>` to `/(auth)/sign-in` rendered.
- `isLoading: false, isAuthenticated: true` → `<Stack />` rendered (children rendered).

### Steps
1. Create `src/providers/__tests__/QueryProvider.test.tsx` with QueryClient config tests. Run — fail (RED).
2. Create `src/providers/QueryProvider.tsx`:
   - Import `QueryClient`, `QueryClientProvider` from `@tanstack/react-query`
   - `const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60 * 2, retry: 3, retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), refetchOnWindowFocus: true }, mutations: { retry: 3, retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000) } } })`
   - Export `QueryProvider` wrapping `<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>`
3. Run `npm run test` on QueryProvider tests — pass (GREEN).
4. Rewrite `app/_layout.tsx`:
   - Import `global.css` (already present — keep it)
   - Import `QueryProvider`, `AuthProvider`, `useAuthStore`
   - Import `Stack`, `Redirect` from `expo-router`
   - Read `isLoading`, `isAuthenticated` from `useAuthStore()`
   - Auth gate: if `isLoading` return `null`; if `!isAuthenticated` return `<Redirect href="/(auth)/sign-in" />`
   - Provider tree: `<QueryProvider><AuthProvider><Stack /></AuthProvider></QueryProvider>`
5. Update `app/index.tsx`: read `isAuthenticated` from `useAuthStore` — if true `<Redirect href="/(app)/groups" />` else `<Redirect href="/(auth)/sign-in" />`.
6. Create `app/(auth)/_layout.tsx`: `import { Stack } from 'expo-router'; export default function AuthLayout() { return <Stack />; }`
7. Write auth gate unit tests (mock `useAuthStore` with `jest.mock`). Run — pass (GREEN).
8. Run `npx tsc --noEmit` — no errors.

### Done When
- [ ] `src/providers/QueryProvider.tsx` exists with correct QueryClient config
- [ ] Unit test: QueryClient `staleTime === 120000`, `retry === 3`, backoff capped at 10000
- [ ] `app/_layout.tsx` wraps in QueryProvider → AuthProvider → Stack
- [ ] Unit test: `isLoading: true` → renders null; `!isAuthenticated` → Redirect to sign-in; authenticated → Stack rendered
- [ ] `app/index.tsx` redirects to `/(app)/groups` or `/(auth)/sign-in` based on auth state
- [ ] `app/(auth)/_layout.tsx` exists and renders `<Stack />`
- [ ] `npm run test` passes
- [ ] `npx tsc --noEmit` passes

### Start command
/tdd TASK-7 SPEC-003

---

## TASK-8: Auth screens, authenticated home, and E2E flows
Status: ⬜ not started
Depends on: TASK-3, TASK-5, TASK-7
Estimated effort: L
Acceptance Criteria Covered: AC-17, AC-19, AC-21, AC-24, AC-25, AC-26

### Context
This task implements all three auth-related screens and the full automated E2E suite.
`app/(auth)/sign-in.tsx` renders three buttons with raw Tailwind classes only (no
design token imports — SPEC-004 concern): "Continue with Google" (calls `signIn('google')`
from TASK-3, shows `Alert.alert()` on error), "Continue with Apple" (disabled, opacity-50,
"Coming soon" label), "Sign in with Magic Link" (navigates to `/(auth)/magic-link`).
`app/(auth)/magic-link.tsx` has two states: (1) email input + "Send Magic Link" button
(disabled until valid email; calls `signIn('magic_link', email)` on tap; inline red error
text on failure), and (2) confirmation view ("Check your email", "Resend" with 60-second
countdown, "Back to sign-in"). `app/(app)/index.tsx` replaces the SPEC-001 smoke test:
reads `user.displayName` and `user.email` from `useAuthStore`, renders "Welcome,
[displayName]" and a "Sign Out" button that calls `signOut()` (TASK-3), resets the
store, and redirects to `/(auth)/sign-in`. Note: `app.config.ts` already has
`scheme: 'halvy'` — no modification needed.

### Files
- CREATE: `app/(auth)/sign-in.tsx`
- CREATE: `app/(auth)/magic-link.tsx`
- MODIFY: `app/(app)/index.tsx`
- CREATE: `e2e/maestro/auth_sign_in.yaml`
- CREATE: `e2e/maestro/auth_magic_link.yaml`
- CREATE: `e2e/maestro/auth_sign_out.yaml`
- CREATE: `e2e/playwright/auth.spec.ts`

### Testing — Unit (Jest + RNTL)
Sign-in screen:
- All three buttons render (query by accessible text).
- Apple button has `accessibilityState={{ disabled: true }}` and shows "Coming soon" text.
- Tapping Magic Link button triggers navigation to `/(auth)/magic-link`.
- Tapping Google button calls `signIn('google')`.
- `signIn('google')` error → `Alert.alert` called with error message.

Magic-link screen:
- State 1: email input and "Send Magic Link" button present.
- "Send Magic Link" disabled while email field is empty.
- "Send Magic Link" disabled while email is not a valid format.
- After successful `signIn('magic_link', email)` → transitions to State 2.
- State 2: "Check your email" text, email shown, "Resend" button, "Back to sign-in".
- "Resend" is initially disabled (60-second countdown).
- `signIn('magic_link')` error → inline red error text shows.

Authenticated home:
- Renders "Welcome, [displayName]" when user in store.
- Renders user email.
- Tapping "Sign Out" calls `signOut()` then `store.reset()` then navigates to sign-in.

### Testing — Mobile E2E (Maestro)
`e2e/maestro/auth_sign_in.yaml`:
- Launch app.
- Assert sign-in screen visible (Halvy logo text present).
- Assert three buttons visible: Google, Apple, Magic Link.
- Assert Apple button is disabled.

`e2e/maestro/auth_magic_link.yaml`:
- Launch app.
- Tap "Sign in with Magic Link".
- Assert magic-link screen visible.
- Type a valid email into the input.
- Tap "Send Magic Link".
- Assert confirmation state: "Check your email" visible.
- Assert "Resend" button is disabled.
- Tap "Back to sign-in" → assert sign-in screen visible again.

`e2e/maestro/auth_sign_out.yaml`:
- (Requires a pre-seeded auth session or test-mode env var to bypass OAuth.)
- Navigate to authenticated home.
- Assert "Welcome," text visible.
- Tap "Sign Out".
- Assert sign-in screen visible.

### Testing — Web E2E (Playwright)
`e2e/playwright/auth.spec.ts` — Page Object Model covering the three journeys above
targeting Expo web (localhost:8081). Use `page.waitForURL`, `expect(locator).toBeVisible()`,
and `page.screenshot()` at key states (sign-in screen, magic-link confirmation,
authenticated home). Tests run via `npm run test:web-e2e`.

### Steps
1. Create `app/(auth)/sign-in.tsx`:
   - Centred vertical layout — "Halvy" logo `text-2xl font-bold text-indigo-500`, subtitle `text-sm text-gray-500`
   - Google button: `onPress={() => signIn('google').then(r => r.error && Alert.alert('Error', r.error.message))}`
   - Apple button: `disabled={true}` with `opacity-50` className and "Coming soon" secondary text
   - Magic Link button: `onPress={() => router.push('/(auth)/magic-link')}`, `bg-indigo-500 text-white`
   - Footer: "By continuing, you agree to our Terms of Service" (plain text, non-functional link)
2. Create `app/(auth)/magic-link.tsx`:
   - Local state: `email` string, `sent` boolean, `error` string | null, `resendCountdown` number
   - State 1 (sent=false): controlled `TextInput` (`keyboardType="email-address"`, `autoCapitalize="none"`), "Send Magic Link" button disabled if email not valid (`/\S+@\S+\.\S+/.test(email)` as a minimal check), on press call `signIn('magic_link', email)` → if success set `sent(true)` and start 60-second countdown, if error set `error`
   - State 2 (sent=true): "Check your email" text, email displayed, "Resend" button (disabled until countdown === 0, shows countdown text), "Back to sign-in" text button → `router.back()`
3. Rewrite `app/(app)/index.tsx`:
   - Read `user` from `useAuthStore()`
   - Render "Welcome, [user?.displayName ?? '']" in `text-xl font-semibold`
   - Render `user?.email` in `text-sm text-gray-500`
   - "Sign Out" button (`text-red-500`): call `signOut()` → `useAuthStore.getState().reset()` → `router.replace('/(auth)/sign-in')`
4. Write unit tests for all three screens. Run — pass (GREEN).
5. Run `npx expo export --platform ios` — exits 0.
6. Run `npx expo export --platform android` — exits 0.
7. Run `npx expo export --platform web` — exits 0.
8. Create `e2e/maestro/auth_sign_in.yaml` with flow steps above.
9. Create `e2e/maestro/auth_magic_link.yaml` with flow steps above.
10. Create `e2e/maestro/auth_sign_out.yaml` with flow steps above.
11. Create `e2e/playwright/auth.spec.ts` with Page Object Model and three test blocks.
12. Run `npm run test:web-e2e` — Playwright tests pass.

### Done When
- [ ] `app/(auth)/sign-in.tsx` renders three buttons; Apple is disabled with "Coming soon"
- [ ] `app/(auth)/magic-link.tsx` state transitions: input → confirmation → back to sign-in
- [ ] `app/(app)/index.tsx` renders "Welcome, [displayName]" and sign-out button
- [ ] Sign-out: calls `signOut()`, resets store, redirects to sign-in
- [ ] `npx expo export --platform ios` exits 0
- [ ] `npx expo export --platform android` exits 0
- [ ] `npx expo export --platform web` exits 0
- [ ] Unit tests for all three screens pass (`npm run test`)
- [ ] `e2e/maestro/auth_sign_in.yaml`, `auth_magic_link.yaml`, `auth_sign_out.yaml` exist
- [ ] `e2e/playwright/auth.spec.ts` exists and `npm run test:web-e2e` passes
- [ ] `npx tsc --noEmit` passes

### Start command
/tdd TASK-8 SPEC-003

---

## Task Dependency Map

```
TASK-1 (migration + types)
  └── TASK-2 (client + toCamel)
        ├── TASK-3 (auth API)  ──────────────────────────────┐
        └── TASK-4 (users API) ─────────────────────────┐   │
                                                         │   │
              TASK-5 (auth store) ← depends on TASK-3   │   │
                └── TASK-6 (AuthProvider) ← TASK-3, TASK-4, TASK-5
                      └── TASK-7 (layout + gate + QueryProvider) ← TASK-5, TASK-6
                            └── TASK-8 (screens + E2E) ← TASK-3, TASK-5, TASK-7
```

TASK-3 and TASK-4 are independent of each other — both depend only on TASK-2 and can
be implemented in any order. TASK-5 depends on TASK-3 only for the `ApiError` type.

---

## Post-Completion Verification

After all 8 tasks are marked ✅ done, run this full verification sequence:

```bash
supabase db reset                              # migration 00004 + seed apply cleanly
npx tsc --noEmit                               # all new files type-check (AC-27)
npm run test                                   # all unit tests pass
npm run test:integration                       # SQL trigger tests pass (needs supabase start)
npx expo export --platform ios                 # bundle oracle (AC-24)
npx expo export --platform android            # bundle oracle (AC-25)
npx expo export --platform web                # bundle oracle (AC-26)
maestro test e2e/maestro/auth_sign_in.yaml
maestro test e2e/maestro/auth_magic_link.yaml
maestro test e2e/maestro/auth_sign_out.yaml
npm run test:web-e2e                           # Playwright auth spec
```

### AC Coverage

| AC | Task | Verification Method |
|----|------|---------------------|
| AC-1 | TASK-1 | `pg_trigger` query + `supabase db reset` exits 0 |
| AC-2 | TASK-1 | SQL idempotency test — duplicate id insert → UPDATE, no error |
| AC-3 | TASK-1 | `supabase db reset` with seed exits 0 |
| AC-4 | TASK-2 | Unit test — Platform.OS mock → correct storage adapter |
| AC-5 | TASK-2 | `npx tsc --noEmit` |
| AC-6 | TASK-3 | `npx tsc --noEmit` + unit tests (5 functions exported) |
| AC-7 | TASK-3 | Unit tests — signIn delegation for all three providers |
| AC-8 | TASK-4 | `npx tsc --noEmit` + unit tests (5 functions, toCamel applied) |
| AC-9 | TASK-4 | Unit test — `getCurrentUser()` deactivated user → `USER_DEACTIVATED` |
| AC-10 | TASK-4 | Unit test — `deleteUser` issues UPDATE not DELETE; `reactivateUser` sets null |
| AC-11 | TASK-5 | `npx tsc --noEmit` + unit tests (store shape + state transitions) |
| AC-12 | TASK-6 | Unit tests — `onAuthStateChange` mock, store update order, hydration guard |
| AC-13 | TASK-7 | `npx tsc --noEmit` + unit test — QueryClient config values |
| AC-14 | TASK-7 | `npx tsc --noEmit` + unit test — auth gate redirect logic |
| AC-15 | TASK-7 | `npx tsc --noEmit` |
| AC-16 | TASK-7 | `npx tsc --noEmit` (file exists, Stack rendered) |
| AC-17 | TASK-8 | Unit test (three buttons, Apple disabled) + `npx expo export` exits 0 |
| AC-18 | Runtime | Google OAuth manual end-to-end on device/simulator |
| AC-19 | TASK-8 | Unit test (state transitions) + `npx expo export` exits 0 |
| AC-20 | Runtime | Magic link deep link manual test on device (`app.config.ts` already has `scheme: 'halvy'`) |
| AC-21 | TASK-8 | Unit test (welcome, sign-out) + `npx tsc --noEmit` |
| AC-22 | Runtime | Multi-provider merge manual test on device |
| AC-23 | Runtime | Supabase dashboard config check (Google OAuth on, Magic Link on, Apple off) |
| AC-24 | TASK-8 | `npx expo export --platform ios` exits 0 |
| AC-25 | TASK-8 | `npx expo export --platform android` exits 0 |
| AC-26 | TASK-8 | `npx expo export --platform web` exits 0 |
| AC-27 | All | `npx tsc --noEmit` after all tasks complete |
| AC-28 | TASK-1 | `src/types/database.ts` regenerated + `npx tsc --noEmit` passes |

### Notes

**Migration filename discrepancy:** The spec references `00002_auth_sync_trigger.sql`
but migrations `00002` and `00003` were created during SPEC-002 development. TASK-1
creates `00004_auth_sync_trigger.sql` — content is identical to the spec.

**app.config.ts scheme already set:** `app.config.ts` already contains `scheme: 'halvy'`.
No modification needed for AC-20 deep link handling.

**Runtime-only ACs:** AC-18, AC-20, AC-22, AC-23 require a live Supabase project with
real Google OAuth credentials and cannot be covered by unit, type, or bundle oracles.
Verify these manually after setting up credentials per the spec's Section 10 prerequisites.

**Maestro sign-out flow:** `auth_sign_out.yaml` requires a pre-authenticated session.
Use a test-mode environment variable or directly seed an auth session via the Supabase
admin API to bypass the Google OAuth step in CI.
