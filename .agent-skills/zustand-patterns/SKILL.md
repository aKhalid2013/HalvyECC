---
name: zustand-patterns
description: >
  Zustand state management patterns for Halvy. Use when creating stores,
  adding state slices, wiring up persistence, or handling auth sign-out reset.
  Triggers: "store", "zustand", "state", "create()", "useStore", "persist",
  "global state", "auth store", "settings store".
origin: Halvy ECC
sources:
  - https://docs.pmnd.rs/zustand/getting-started/introduction
  - https://docs.pmnd.rs/zustand/guides/slices-pattern
---

# Zustand Patterns — Halvy

## Core Rules

1. **Never put derived state in a store.** Compute it in selectors.
2. **Every store MUST have a `reset()` action.** Called on auth sign-out.
3. **Persist only auth tokens and user preferences.** Never expense data.
4. **One store file per feature domain.** `src/stores/{feature}Store.ts`
5. **Use immer middleware** for nested state updates.
6. **No store imports in shared UI components.** Pass via props.

## File Naming

```
src/stores/
  authStore.ts        ← auth state, tokens, user profile
  groupStore.ts       ← active group context
  expenseStore.ts     ← optimistic expense mutations
  settingsStore.ts    ← user preferences (persisted to AsyncStorage)
```

## Standard Store Pattern

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ExpenseState {
  pendingExpenses: PendingExpense[];
  isSubmitting: boolean;
  addPending: (expense: PendingExpense) => void;
  removePending: (id: string) => void;
  setSubmitting: (value: boolean) => void;
  reset: () => void;
}

const initialState = {
  pendingExpenses: [],
  isSubmitting: false,
};

export const useExpenseStore = create<ExpenseState>()(
  immer((set) => ({
    ...initialState,
    addPending: (expense) =>
      set((state) => { state.pendingExpenses.push(expense); }),
    removePending: (id) =>
      set((state) => {
        state.pendingExpenses = state.pendingExpenses.filter((e) => e.id !== id);
      }),
    setSubmitting: (value) =>
      set((state) => { state.isSubmitting = value; }),
    reset: () => set(initialState),
  }))
);
```

## Persisted Store (settings only)

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialSettings = {
  currency: 'EGP',
  theme: 'system' as const,
  notificationsEnabled: true,
};

export const useSettingsStore = create()(
  persist(
    (set) => ({
      ...initialSettings,
      setCurrency: (currency: string) => set({ currency }),
      setTheme: (theme: typeof initialSettings.theme) => set({ theme }),
      reset: () => set(initialSettings),
    }),
    {
      name: 'halvy-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

## Auth Sign-Out — Reset All Stores

```typescript
// Call this when the user signs out
export async function signOut() {
  useAuthStore.getState().reset();
  useExpenseStore.getState().reset();
  useGroupStore.getState().reset();
  // Do NOT reset settingsStore — preserve user preferences
  await supabase.auth.signOut();
}
```

## Memoized Selectors (prevents re-render cascades)

```typescript
// Define outside components
const selectPendingCount = (state: ExpenseState) => state.pendingExpenses.length;

// In component:
const pendingCount = useExpenseStore(selectPendingCount);
// NOT: const { pendingExpenses } = useExpenseStore() ← re-renders on any state change
```

## Anti-Patterns

```typescript
// ❌ Derived state in store
set({ totalBalance: expenses.reduce((s, e) => s + e.amount, 0) });
// ✅ Compute in selector

// ❌ Full store subscription
const store = useExpenseStore();
// ✅ Slice subscription
const isSubmitting = useExpenseStore((s) => s.isSubmitting);

// ❌ No reset action — every store must have reset: () => set(initialState)
```
