# SPEC-003 Implementation Plan
# Auth — Supabase Auth, Client Singleton, Auth Gate, Sign-In Screens

**Spec:** docs/specs/phase-1/SPEC-003-auth.md
**Branch:** feat/SPEC-003-auth
**Generated:** 2026-04-11

---

## Approval Checklist (developer reviews before running /tdd)
- [ ] Tasks are correctly ordered (no circular deps)
- [ ] Each task has clear acceptance criteria
- [ ] File paths are accurate for this project structure
- [ ] No task exceeds ~200 lines of implementation
- [ ] Edge cases are covered

---

## TASK-1: Auth Sync Trigger Migration + Type Regeneration

**Status:** ✅ done
**Spec ACs covered:** AC-1, AC-2, AC-3, AC-28
**Estimated size:** S

### What to build

Create the second migration file `supabase/migrations/00002_auth_sync_trigger.sql` containing the `fn_auth_sync_user()` trigger function and `trg_auth_sync_user` trigger on `auth.users`. This trigger syncs new auth sign-ups into `public.users` using `INSERT ... ON CONFLICT (id) DO UPDATE` for idempotent multi-provider merge. After applying the migration, regenerate `src/types/database.ts` and update `supabase/MIGRATION_LOG.md`.

### Files
- CREATE `supabase/migrations/00002_auth_sync_trigger.sql`
- REGENERATE `src/types/database.ts`
- MODIFY `supabase/MIGRATION_LOG.md`

### Acceptance criteria (testable)
- [ ] Migration file creates `fn_auth_sync_user()` function with `SECURITY DEFINER` and `SET search_path = public`
- [ ] Trigger `trg_auth_sync_user` fires `AFTER INSERT ON auth.users FOR EACH ROW`
- [ ] Function extracts `display_name` from `raw_user_meta_data->>'full_name'`, falling back to `->>'name'`, falling back to email local part
- [ ] Function extracts `avatar_url` from `raw_user_meta_data->>'avatar_url'` or `->>'picture'`
- [ ] Function derives `auth_provider` from `raw_app_meta_data->>'provider'`, defaulting to `'magic_link'`
- [ ] Uses `INSERT ... ON CONFLICT (id) DO UPDATE` — updating row on duplicate id rather than failing
- [ ] `COALESCE` on UPDATE prevents overwriting a good `display_name`/`avatar_url` with null
- [ ] `supabase db reset` applies both `00001_initial_schema.sql` and `00002_auth_sync_trigger.sql` without errors
- [ ] Seed data from SPEC-002 continues to work (seed inserts into `public.users` directly, no conflict)
- [ ] `src/types/database.ts` is regenerated and `npx tsc --noEmit` passes
- [ ] `supabase/MIGRATION_LOG.md` has an entry for `00002_auth_sync_trigger.sql`

### Context

```sql
-- DOWN rollback:
-- DROP TRIGGER IF EXISTS trg_auth_sync_user ON auth.users;
-- DROP FUNCTION IF EXISTS fn_auth_sync_user();

CREATE OR REPLACE FUNCTION fn_auth_sync_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _display_name TEXT;
  _avatar_url   TEXT;
  _provider     TEXT;
BEGIN
  _display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );
  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  _provider := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    'magic_link'
  );
  INSERT INTO public.users (id, email, display_name, avatar_url, auth_provider)
  VALUES (NEW.id, NEW.email, _display_name, _avatar_url, _provider)
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    avatar_url   = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at   = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_sync_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_auth_sync_user();
```

Regeneration command: `npx supabase gen types typescript --local > src/types/database.ts`

MIGRATION_LOG.md format: date, description, DOWN rollback section (copy DROP statements above).

---

## TASK-2: Install npm Dependencies

**Status:** ✅ done
**Spec ACs covered:** AC-24, AC-25, AC-26 (partial — enables bundle compilation)
**Estimated size:** S

### What to build

Install the 6 new npm packages required by SPEC-003 and update `jest.config.js` to include the new Expo packages in `transformIgnorePatterns`. Verify `app.config.ts` already has `scheme: 'halvy'` (no change needed if present).

### Files
- MODIFY `package.json` (via `npm install`)
- MODIFY `jest.config.js` (add new packages to transformIgnorePatterns)

### Acceptance criteria (testable)
- [ ] `@supabase/supabase-js` is in `dependencies`
- [ ] `expo-secure-store` is in `dependencies`
- [ ] `@tanstack/react-query` is in `dependencies`
- [ ] `expo-auth-session` is in `dependencies`
- [ ] `expo-web-browser` is in `dependencies`
- [ ] `expo-crypto` is in `dependencies`
- [ ] `app.config.ts` has `scheme: 'halvy'` (verify; already present from SPEC-001)
- [ ] `jest.config.js` `transformIgnorePatterns` includes `expo-secure-store`, `expo-auth-session`, `expo-web-browser`, `expo-crypto`, `@supabase`, `@tanstack`
- [ ] `npx tsc --noEmit` passes
- [ ] `npx expo export --platform ios` exits 0
- [ ] `npx expo export --platform android` exits 0
- [ ] `npx expo export --platform web` exits 0

### Context

Install command:
```bash
npm install @supabase/supabase-js expo-secure-store @tanstack/react-query expo-auth-session expo-web-browser expo-crypto
```

Current `jest.config.js` has `transformIgnorePatterns` for expo, react-native, nativewind, etc. Extend the existing pattern string to include the new packages. The pattern is a regex string like:
```
node_modules/(?!(expo|expo-router|expo-secure-store|expo-auth-session|expo-web-browser|expo-crypto|@supabase|@tanstack|nativewind|...)/)
```

`app.config.ts` already has `scheme: 'halvy'` at line 39 — verify but do not change unless absent.

---

## TASK-3: API Types + toCamel Utility

**Status:** ✅ done
**Spec ACs covered:** AC-6 (partial — types only), AC-8 (partial — types only)
**Estimated size:** S

### What to build

Create the shared API types (`ApiResult`, `ApiError`) and the `toCamel()` snake_case-to-camelCase transform utility. These are referenced by every API module in the project.

### Files
- CREATE `src/api/types.ts`
- CREATE `src/utils/transforms.ts`
- CREATE `src/utils/__tests__/transforms.test.ts`

### Acceptance criteria (testable)
- [ ] `src/api/types.ts` exports `ApiResult<T>` discriminated union: `{ data: T; error: null } | { data: null; error: ApiError }`
- [ ] `src/api/types.ts` exports `ApiError` interface with `code: string`, `message: string`, `status?: number`
- [ ] `src/utils/transforms.ts` exports `toCamel<T>(obj)` that recursively converts snake_case keys to camelCase
- [ ] `toCamel` handles: flat object, nested object, null/undefined passthrough, array of objects, already-camelCase keys (no-op)
- [ ] Unit tests cover all five cases above
- [ ] `npx tsc --noEmit` passes
- [ ] `npx jest src/utils/__tests__/transforms.test.ts` passes

### Context

```typescript
// src/api/types.ts
export type ApiResult<T> =
  | { data: T;    error: null     }
  | { data: null; error: ApiError }

export interface ApiError {
  code:    string
  message: string
  status?: number
}
```

```typescript
// src/utils/transforms.ts
export function toCamel<T>(obj: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      v && typeof v === 'object' && !Array.isArray(v)
        ? toCamel(v as Record<string, unknown>)
        : v
    ])
  ) as T
}
```

Enhance `toCamel` to handle: `null` input → return `null`; arrays → map each element through `toCamel`; primitives → return as-is.

---

## TASK-4: Supabase Client Singleton

**Status:** ✅ done
**Spec ACs covered:** AC-4, AC-5
**Estimated size:** S

### What to build

Create the Supabase client singleton at `src/api/client.ts` with a platform-aware secure token storage adapter. Native uses `expo-secure-store`; web uses Supabase default (localStorage).

### Files
- CREATE `src/api/client.ts`
- CREATE `src/api/__tests__/client.test.ts`

### Acceptance criteria (testable)
- [ ] Exports a `supabase` singleton created by `createClient<Database>()`
- [ ] Reads `config.supabaseUrl` and `config.supabaseAnonKey` from `@/constants/config`
- [ ] On `Platform.OS !== 'web'`: uses `ExpoSecureStoreAdapter` with `getItemAsync`, `setItemAsync`, `deleteItemAsync`
- [ ] On `Platform.OS === 'web'`: storage is `undefined` (Supabase default = localStorage)
- [ ] `autoRefreshToken: true`, `persistSession: true`
- [ ] `detectSessionInUrl` is `true` on web, `false` on native
- [ ] Unit test mocks `Platform.OS` and verifies correct adapter selection
- [ ] `npx tsc --noEmit` passes

### Context

```typescript
// src/api/client.ts
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { config } from '@/constants/config'
import type { Database } from '@/types/database'

const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient<Database>(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      storage:          Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
)
```

`Database` type comes from `src/types/database.ts` (SPEC-002 + TASK-1 regeneration). `config` comes from `src/constants/config.ts` (SPEC-001, already exists). Both `supabaseUrl` and `supabaseAnonKey` are already in the config shape.

For unit testing: mock `Platform`, mock `expo-secure-store`, mock `@supabase/supabase-js` `createClient`. Capture the `options` arg passed to `createClient` and assert on `auth.storage` and `auth.detectSessionInUrl`.

---

## TASK-5: Auth API Module

**Status:** ✅ done
**Spec ACs covered:** AC-6, AC-7
**Estimated size:** M

### What to build

Create `src/api/auth.ts` with all five functions from api-contracts.md. Google OAuth uses `signInWithOAuth` with Expo AuthSession redirect. Magic Link uses `signInWithOtp`. Apple returns a stub `AUTH_PROVIDER_UNAVAILABLE` error.

### Files
- CREATE `src/api/auth.ts`
- CREATE `src/api/__tests__/auth.test.ts`

### Acceptance criteria (testable)
- [ ] Exports `signIn(provider, email?)`, `signOut()`, `signOutAllDevices()`, `getSession()`, `onAuthStateChange(callback)`
- [ ] All return types match api-contracts.md
- [ ] `signIn('google')` calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with correct redirect
- [ ] `signIn('magic_link', email)` calls `supabase.auth.signInWithOtp({ email })`
- [ ] `signIn('apple')` returns `{ data: null, error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Apple sign-in coming soon' } }`
- [ ] `signOut()` calls `supabase.auth.signOut()`
- [ ] `signOutAllDevices()` calls `supabase.auth.signOut({ scope: 'global' })`
- [ ] `getSession()` calls `supabase.auth.getSession()`
- [ ] `onAuthStateChange(callback)` returns an unsubscribe function
- [ ] All Supabase errors are caught and wrapped in `ApiResult` error shape
- [ ] Unit tests mock `supabase.auth` and verify all 5 functions + Apple stub
- [ ] `npx tsc --noEmit` passes

### Context

```typescript
import type { Session } from '@supabase/supabase-js'
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './client'
import type { ApiResult } from './types'

WebBrowser.maybeCompleteAuthSession()

type AuthProvider = 'google' | 'apple' | 'magic_link'
type Unsubscribe = () => void

export async function signIn(provider: AuthProvider, email?: string): Promise<ApiResult<Session | null>> {
  try {
    if (provider === 'apple') {
      return { data: null, error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Apple sign-in coming soon' } }
    }
    if (provider === 'magic_link') {
      const { error } = await supabase.auth.signInWithOtp({ email: email! })
      if (error) return { data: null, error: { code: 'AUTH_ERROR', message: error.message } }
      return { data: null, error: null }  // session arrives via onAuthStateChange
    }
    // Google OAuth
    const redirectTo = makeRedirectUri()
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) return { data: null, error: { code: 'AUTH_ERROR', message: error.message } }
    return { data: null, error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'AUTH_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}
```

Error wrapping pattern applies to all functions. `onAuthStateChange` return value: `supabase.auth.onAuthStateChange` returns `{ data: { subscription } }` — extract and return `() => subscription.unsubscribe()`.

---

## TASK-6: Users API Module

**Status:** ✅ done
**Spec ACs covered:** AC-8, AC-9, AC-10
**Estimated size:** M

### What to build

Create `src/api/users.ts` with all five CRUD functions. Queries `public.users` via Supabase. Applies `toCamel()` to responses. `deleteUser()` is a soft delete. `reactivateUser()` clears `deleted_at`.

### Files
- CREATE `src/api/users.ts`
- CREATE `src/api/__tests__/users.test.ts`

### Acceptance criteria (testable)
- [ ] Exports `getUser(userId)`, `getCurrentUser()`, `updateUser(userId, payload)`, `deleteUser(userId)`, `reactivateUser(userId)`
- [ ] `getCurrentUser()` calls `supabase.auth.getUser()` then queries `public.users` by the auth id
- [ ] `getCurrentUser()` returns `{ code: 'USER_DEACTIVATED' }` error when `deleted_at` is non-null
- [ ] `deleteUser()` sets `deleted_at` to `now()` via UPDATE (no physical DELETE)
- [ ] `reactivateUser()` sets `deleted_at` to `null` via UPDATE
- [ ] All responses pass through `toCamel()` from `@/utils/transforms`
- [ ] `updateUser()` accepts `{ displayName?, avatarUrl? }` and converts to snake_case before query
- [ ] `User` type does NOT include `reliabilityScore`
- [ ] Unit tests cover: active user fetch, deactivated user detection, soft delete, reactivate, toCamel transform
- [ ] `npx tsc --noEmit` passes

### Context

`User` interface from `src/types/models.ts` (SPEC-002):
```typescript
interface User {
  id: string; email: string; displayName: string; avatarUrl: string | null
  authProvider: string; createdAt: string; updatedAt: string; deletedAt: string | null
}
```

Payload mapping for `updateUser`:
```typescript
interface UpdateUserPayload { displayName?: string; avatarUrl?: string | null }
// Map to: { display_name?, avatar_url? } for Supabase UPDATE
```

`getCurrentUser()` pattern:
```typescript
const { data: authData, error: authError } = await supabase.auth.getUser()
if (authError || !authData.user) return { data: null, error: { code: 'NOT_AUTHENTICATED', message: '...' } }
const { data, error } = await supabase.from('users').select('*').eq('id', authData.user.id).single()
if (error) return { data: null, error: { code: 'USER_NOT_FOUND', message: error.message } }
if (data.deleted_at) return { data: null, error: { code: 'USER_DEACTIVATED', message: 'Account is deactivated' } }
return { data: toCamel<User>(data), error: null }
```

---

## TASK-7: Auth State Store (Zustand)

**Status:** pending
**Spec ACs covered:** AC-11
**Estimated size:** S

### What to build

Create the Zustand auth store with session, user, loading, error state, and derived `isAuthenticated` getter.

### Files
- CREATE `src/stores/authStore.ts`
- CREATE `src/stores/__tests__/authStore.test.ts`

### Acceptance criteria (testable)
- [ ] Store shape: `{ session, user, isLoading, isAuthenticated, error, setSession, setUser, setLoading, setError, reset }`
- [ ] Initial state: `session: null, user: null, isLoading: true, error: null`
- [ ] `isAuthenticated` is derived: `true` only when `session !== null` AND `user !== null`
- [ ] `reset()` returns all fields to initial values (`isLoading: false` after initial hydration)
- [ ] Unit tests verify: initial state, all setters, `isAuthenticated` derivation (4 cases), `reset()` behavior
- [ ] `npx tsc --noEmit` passes

### Context

Zustand 5.x (already installed). Pattern for derived state:
```typescript
import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { User } from '@/types/models'
import type { ApiError } from '@/api/types'

interface AuthState {
  session:         Session | null
  user:            User | null
  isLoading:       boolean
  isAuthenticated: boolean
  error:           ApiError | null
  setSession: (session: Session | null) => void
  setUser:    (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError:   (error: ApiError | null) => void
  reset:      () => void
}

const initialState = { session: null, user: null, isLoading: true, error: null }

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...initialState,
  get isAuthenticated() { return get().session !== null && get().user !== null },
  setSession: (session) => set({ session }),
  setUser:    (user)    => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError:   (error)   => set({ error }),
  reset:      ()        => set({ ...initialState, isLoading: false }),
}))
```

Note: `reset()` sets `isLoading: false` (not `true`) because initial hydration is complete by the time `reset()` is called.

---

## TASK-8: QueryProvider

**Status:** pending
**Spec ACs covered:** AC-13
**Estimated size:** S

### What to build

Create `src/providers/QueryProvider.tsx` wrapping the app in a `QueryClient` configured per api-contracts.md.

### Files
- CREATE `src/providers/QueryProvider.tsx`
- CREATE `src/providers/__tests__/QueryProvider.test.tsx`

### Acceptance criteria (testable)
- [ ] Exports default `QueryProvider` component wrapping children in `QueryClientProvider`
- [ ] `QueryClient` has: `staleTime: 120000`, `retry: 3`, `retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000)`, `refetchOnWindowFocus: true`
- [ ] Same retry/retryDelay config on mutations
- [ ] Unit test renders `QueryProvider` with a child and verifies no crash
- [ ] `npx tsc --noEmit` passes

### Context

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 2,
      retry:                3,
      retryDelay:           (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry:      3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
  },
})

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

To test config values: extract `queryClient` as a named export or expose a `getConfig()` helper, then assert on the options in the test. Alternatively, render with a test child that calls `useQueryClient()` and reads the defaults.

---

## TASK-9: AuthProvider

**Status:** pending
**Spec ACs covered:** AC-12
**Estimated size:** M

### What to build

Create `src/providers/AuthProvider.tsx` that subscribes to `onAuthStateChange`, fetches the current user when a session arrives, updates the auth store, and blocks rendering until initial hydration is resolved.

### Files
- CREATE `src/providers/AuthProvider.tsx`
- CREATE `src/providers/__tests__/AuthProvider.test.tsx`

### Acceptance criteria (testable)
- [ ] Subscribes to `onAuthStateChange` on mount
- [ ] When session is received: sets session in store + fetches `getCurrentUser()` + sets user (or error)
- [ ] When session becomes null: calls `store.reset()`
- [ ] While `isLoading: true`: renders `null` (not children)
- [ ] After hydration: `isLoading: false`, renders children
- [ ] If `getCurrentUser()` returns `USER_DEACTIVATED`: sets error, does not set user
- [ ] Unsubscribes on unmount
- [ ] Unit tests mock `@/api/auth` and `@/api/users`, simulate session events, verify store transitions
- [ ] `npx tsc --noEmit` passes

### Context

```tsx
import { useEffect } from 'react'
import { onAuthStateChange } from '@/api/auth'
import { getCurrentUser } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, setSession, setUser, setLoading, setError, reset } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (session) => {
      if (session) {
        setSession(session)
        const result = await getCurrentUser()
        if (result.data) {
          setUser(result.data)
        } else {
          setError(result.error)
        }
      } else {
        reset()
      }
      setLoading(false)
    })

    return () => { unsubscribe() }
  }, [])

  if (isLoading) return null

  return <>{children}</>
}
```

Supabase fires `onAuthStateChange` immediately with the current session on subscription — this handles initial hydration. After the callback completes once, `setLoading(false)` is called.

For testing: mock `@/api/auth` → `onAuthStateChange` captures the callback; call it manually with a mock session or `null` to simulate events. Mock `@/api/users` → `getCurrentUser` returns controlled responses. Use `@testing-library/react-native` `act()` for async state updates.

---

## TASK-10: Root Layout + Auth Gate + Entry Redirect

**Status:** pending
**Spec ACs covered:** AC-14, AC-15, AC-16
**Estimated size:** M

### What to build

Update `app/_layout.tsx` to nest providers (QueryProvider, AuthProvider). Update `app/index.tsx` with auth-aware redirect. Create `app/(auth)/_layout.tsx`.

### Files
- MODIFY `app/_layout.tsx`
- MODIFY `app/index.tsx`
- CREATE `app/(auth)/_layout.tsx`

### Acceptance criteria (testable)
- [ ] `app/_layout.tsx` wraps (outer-to-inner): QueryProvider → AuthProvider → Stack (headerShown: false)
- [ ] `app/index.tsx`: if `isLoading` → render null; if `isAuthenticated` → Redirect to `/(app)`; else → Redirect to `/(auth)/sign-in`
- [ ] `app/(auth)/_layout.tsx` renders `<Stack screenOptions={{ headerShown: false }} />`
- [ ] Unauthenticated user sees sign-in screen (not the app)
- [ ] `npx tsc --noEmit` passes

### Context

Current `app/_layout.tsx`:
```tsx
import '../global.css';
import { Slot } from 'expo-router';
export default function RootLayout() { return <Slot />; }
```

New `app/_layout.tsx`:
```tsx
import '../global.css';
import { Stack } from 'expo-router';
import QueryProvider from '@/providers/QueryProvider';
import AuthProvider from '@/providers/AuthProvider';

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryProvider>
  );
}
```

Current `app/index.tsx` unconditionally redirects to `/(app)`. Replace:
```tsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (isAuthenticated) return <Redirect href="/(app)" />;
  return <Redirect href="/(auth)/sign-in" />;
}
```

Check whether `app/(auth)/` directory exists already; if not, create it. `app/(app)/_layout.tsx` already exists (bare Slot from SPEC-001) — do not modify it.

---

## TASK-11: Sign-In Screen

**Status:** pending
**Spec ACs covered:** AC-17, AC-18
**Estimated size:** M

### What to build

Create `app/(auth)/sign-in.tsx` with Google (functional), Apple (disabled stub), and Magic Link buttons.

### Files
- CREATE `app/(auth)/sign-in.tsx`

### Acceptance criteria (testable)
- [ ] Renders three buttons: "Continue with Google", "Continue with Apple", "Sign in with Magic Link"
- [ ] "Continue with Google" calls `signIn('google')` from `@/api/auth`
- [ ] "Continue with Apple" is `opacity-50` and shows `Alert.alert('Apple sign-in coming soon', ...)`
- [ ] "Sign in with Magic Link" navigates to `/(auth)/magic-link`
- [ ] Logo "Halvy" in `text-2xl font-bold text-indigo-500`; subtitle "Split expenses, not friendships" in `text-sm text-gray-500`
- [ ] Footer: "By continuing, you agree to our Terms of Service"
- [ ] Google OAuth error → `Alert.alert('Sign-in Error', result.error.message)`
- [ ] `npx tsc --noEmit` passes

### Context

```tsx
import { View, Text, Pressable, Alert } from 'react-native'
import { router } from 'expo-router'
import { signIn } from '@/api/auth'

export default function SignInScreen() {
  const handleGoogleSignIn = async () => {
    const result = await signIn('google')
    if (result.error) Alert.alert('Sign-in Error', result.error.message)
    // Success: onAuthStateChange in AuthProvider handles redirect
  }

  const handleApple = () => {
    Alert.alert('Coming soon', 'Apple sign-in will be available soon.')
  }

  return (
    <View className="flex-1 items-center justify-center px-6 bg-white dark:bg-gray-900">
      <Text className="text-2xl font-bold text-indigo-500">Halvy</Text>
      <Text className="text-sm text-gray-500 mt-2">Split expenses, not friendships</Text>

      <View className="w-full mt-12 gap-3">
        <Pressable onPress={handleGoogleSignIn}
          className="w-full h-12 border border-gray-300 rounded-xl items-center justify-center">
          <Text className="font-medium text-gray-700">Continue with Google</Text>
        </Pressable>

        <Pressable onPress={handleApple}
          className="w-full h-12 bg-gray-100 rounded-xl items-center justify-center opacity-50">
          <Text className="font-medium text-gray-700">Continue with Apple</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/magic-link')}
          className="w-full h-12 bg-indigo-500 rounded-xl items-center justify-center">
          <Text className="font-medium text-white">Sign in with Magic Link</Text>
        </Pressable>
      </View>

      <Text className="text-xs text-gray-400 mt-8">
        By continuing, you agree to our Terms of Service
      </Text>
    </View>
  )
}
```

---

## TASK-12: Magic Link Screen

**Status:** pending
**Spec ACs covered:** AC-19, AC-20
**Estimated size:** M

### What to build

Create `app/(auth)/magic-link.tsx` with two states: email input and confirmation. Includes 60-second resend cooldown.

### Files
- CREATE `app/(auth)/magic-link.tsx`

### Acceptance criteria (testable)
- [ ] State 1: email input (`keyboardType="email-address"`, `autoCapitalize="none"`), "Send Magic Link" button (disabled until `email.includes('@')` and `email.includes('.')`), back navigation
- [ ] Tapping "Send Magic Link" calls `signIn('magic_link', email)`; success → State 2; failure → inline error in `text-red-500`
- [ ] State 2: checkmark, "Check your email", "We sent a sign-in link to [email]", "Resend" (60s cooldown with countdown), back navigation
- [ ] "Resend" re-calls `signIn('magic_link', email)`, resets countdown
- [ ] Back navigation uses `router.back()`
- [ ] `npx tsc --noEmit` passes

### Context

```tsx
import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { router } from 'expo-router'
import { signIn } from '@/api/auth'

type ScreenState = 'input' | 'confirmation'

export default function MagicLinkScreen() {
  const [state, setState] = useState<ScreenState>('input')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(id)
  }, [countdown])

  const isValidEmail = email.includes('@') && email.includes('.')

  const handleSend = async () => {
    setIsLoading(true)
    setError(null)
    const result = await signIn('magic_link', email)
    setIsLoading(false)
    if (result.error) {
      setError('Failed to send link. Please try again.')
    } else {
      setState('confirmation')
      setCountdown(60)
    }
  }

  if (state === 'confirmation') {
    return (
      <View className="flex-1 items-center justify-center px-6 bg-white dark:bg-gray-900">
        <Text className="text-4xl mb-4">✓</Text>
        <Text className="text-xl font-semibold text-gray-900 dark:text-white">Check your email</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          We sent a sign-in link to {email}
        </Text>
        <Pressable
          onPress={handleSend}
          disabled={countdown > 0}
          className={`mt-8 ${countdown > 0 ? 'opacity-50' : ''}`}
        >
          <Text className="text-indigo-500">
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-gray-500">Back to sign-in</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="flex-1 px-6 bg-white dark:bg-gray-900" style={{ paddingTop: 60 }}>
      <Pressable onPress={() => router.back()} className="mb-8">
        <Text className="text-indigo-500">← Back to sign-in</Text>
      </Pressable>
      <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Enter your email
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="you@example.com"
        className="w-full h-12 border border-gray-300 rounded-xl px-4 text-gray-900 dark:text-white"
      />
      {error && <Text className="text-red-500 text-sm mt-2">{error}</Text>}
      <Pressable
        onPress={handleSend}
        disabled={!isValidEmail || isLoading}
        className={`w-full h-12 bg-indigo-500 rounded-xl items-center justify-center mt-4
          ${(!isValidEmail || isLoading) ? 'opacity-50' : ''}`}
      >
        <Text className="font-medium text-white">
          {isLoading ? 'Sending...' : 'Send Magic Link'}
        </Text>
      </Pressable>
    </View>
  )
}
```

---

## TASK-13: Authenticated Home Screen

**Status:** pending
**Spec ACs covered:** AC-21
**Estimated size:** S

### What to build

Replace the SPEC-001 smoke test in `app/(app)/index.tsx` with an authenticated home screen showing the user's display name, email, and a sign-out button.

### Files
- MODIFY `app/(app)/index.tsx`

### Acceptance criteria (testable)
- [ ] Displays "Welcome, [user.displayName]"
- [ ] Displays `user.email` in `text-sm text-gray-500`
- [ ] "Sign Out" button in `text-red-500`
- [ ] Tapping "Sign Out" calls `signOut()` from `@/api/auth`
- [ ] Error → `Alert.alert('Error', result.error.message)`
- [ ] On success: `onAuthStateChange` triggers `store.reset()`, auth gate redirects to sign-in
- [ ] `npx tsc --noEmit` passes

### Context

```tsx
import { View, Text, Pressable, Alert } from 'react-native'
import { signOut } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

export default function HomeScreen() {
  const { user } = useAuthStore()

  const handleSignOut = async () => {
    const result = await signOut()
    if (result.error) Alert.alert('Error', result.error.message)
    // AuthProvider's onAuthStateChange → store.reset() → auth gate → sign-in
  }

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
      <Text className="text-xl font-semibold text-gray-900 dark:text-white">
        Welcome, {user?.displayName}
      </Text>
      <Text className="text-sm text-gray-500 mt-1">{user?.email}</Text>
      <Pressable onPress={handleSignOut} className="mt-8">
        <Text className="text-red-500">Sign Out</Text>
      </Pressable>
    </View>
  )
}
```

---

## TASK-14: Supabase Auth Config + Integration Verification

**Status:** pending
**Spec ACs covered:** AC-22, AC-23, AC-24, AC-25, AC-26, AC-27
**Estimated size:** S

### What to build

Configure `supabase/config.toml` for local auth (Google OAuth, Magic Link, Apple disabled). Run full compilation and export verification. Document manual test procedures for AC-22 (multi-provider merge).

### Files
- MODIFY `supabase/config.toml`

### Acceptance criteria (testable)
- [ ] `supabase/config.toml` `[auth]` section has `site_url = "halvy://"` and `additional_redirect_urls = ["halvy://", "http://localhost:8081"]`
- [ ] `[auth.email]` section has `enable_signup = true`
- [ ] `[auth.external.google]` section has `enabled = true`
- [ ] `[auth.external.apple]` section has `enabled = false`
- [ ] `supabase db reset` applies both migrations without errors (AC-23)
- [ ] `npx tsc --noEmit` passes (AC-27)
- [ ] `npx expo export --platform ios` exits 0 (AC-24)
- [ ] `npx expo export --platform android` exits 0 (AC-25)
- [ ] `npx expo export --platform web` exits 0 (AC-26)

### Context

`supabase/config.toml` additions:
```toml
[auth]
enabled = true
site_url = "halvy://"
additional_redirect_urls = ["halvy://", "http://localhost:8081"]

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
# Actual values set via Supabase Dashboard for remote project

[auth.external.apple]
enabled = false
```

Manual test procedure for AC-22 (multi-provider merge — requires real credentials):
1. Sign in with Google using email `x@example.com` → verify `public.users` row created with `auth_provider = 'google'`
2. Sign out
3. Sign in with Magic Link to same email → Supabase merges accounts
4. Verify the same `public.users.id` is retained (trigger uses `ON CONFLICT (id) DO UPDATE`)

This task is primarily verification. If all prior tasks are correct, the compilation and export checks should pass automatically.

---

## Dependency Graph

```
TASK-1 (migration)   TASK-2 (npm deps)   TASK-3 (API types + toCamel)
         │                  │                      │
         └──────────────────┼──────────────────────┘
                            │
                       TASK-4 (supabase client)
                            │
                   ┌────────┴────────┐
             TASK-5 (auth.ts)    TASK-6 (users.ts)
                   │                 │
                   └────────┬────────┘
                            │
                       TASK-7 (authStore)
                            │
                       TASK-8 (QueryProvider)
                            │
                       TASK-9 (AuthProvider)
                            │
                       TASK-10 (root layout + auth gate)
                            │
              ┌─────────────┼──────────────┐
          TASK-11        TASK-12        TASK-13
         (sign-in)    (magic-link)    (auth home)
              │             │              │
              └─────────────┴──────────────┘
                            │
                       TASK-14 (config + verification)
```

---

## Verification Commands

After all tasks complete:

```bash
supabase db reset                         # Both migrations apply cleanly
npx tsc --noEmit                          # TypeScript compiles
npx jest                                  # All unit tests pass
npx expo export --platform ios            # iOS bundle
npx expo export --platform android       # Android bundle
npx expo export --platform web           # Web bundle
```

---

## AC Coverage Matrix

| AC | Task(s) |
|----|---------|
| AC-1 | TASK-1 |
| AC-2 | TASK-1 |
| AC-3 | TASK-1 |
| AC-4 | TASK-4 |
| AC-5 | TASK-4 |
| AC-6 | TASK-3 + TASK-5 |
| AC-7 | TASK-5 |
| AC-8 | TASK-3 + TASK-6 |
| AC-9 | TASK-6 |
| AC-10 | TASK-6 |
| AC-11 | TASK-7 |
| AC-12 | TASK-9 |
| AC-13 | TASK-8 |
| AC-14 | TASK-10 |
| AC-15 | TASK-10 |
| AC-16 | TASK-10 |
| AC-17 | TASK-11 |
| AC-18 | TASK-11 + TASK-14 |
| AC-19 | TASK-12 |
| AC-20 | TASK-12 + TASK-14 |
| AC-21 | TASK-13 |
| AC-22 | TASK-14 |
| AC-23 | TASK-14 |
| AC-24 | TASK-14 |
| AC-25 | TASK-14 |
| AC-26 | TASK-14 |
| AC-27 | TASK-14 |
| AC-28 | TASK-1 |
