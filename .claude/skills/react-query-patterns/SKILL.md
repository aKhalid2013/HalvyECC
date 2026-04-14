---
name: react-query-patterns
description: >
  TanStack Query (React Query v5) patterns for Halvy. Use when creating
  data-fetching hooks, cache invalidation, optimistic updates, or infinite
  scroll. Triggers: "useQuery", "useMutation", "react-query", "tanstack",
  "cache", "fetch data", "optimistic update", "invalidate", "infinite scroll".
origin: Halvy ECC
sources:
  - https://tanstack.com/query/latest/docs/framework/react/overview
  - https://github.com/lukemorales/query-key-factory
  - https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
---

# React Query Patterns — Halvy

## Core Rules

1. **All query keys defined in** `src/api/queryKeys.ts` via query-key-factory. No inline strings.
2. **Optimistic updates required** for: expense create/update/delete, settlement, reactions.
3. **Cache times:** 5min expense lists · 30s balance summaries · 1min group lists.
4. **Invalidate on Supabase Realtime events** — not on timers.
5. **All hooks live in** `src/features/{name}/hooks/` or `src/api/`.

## Query Key Factory

```typescript
// src/api/queryKeys.ts
import { createQueryKeyStore } from '@lukemorales/query-key-factory';

export const queries = createQueryKeyStore({
  groups: {
    all: null,
    detail: (groupId: string) => ({ groupId }),
    expenses: (groupId: string) => ({ groupId }),
    balance: (groupId: string) => ({ groupId }),
    members: (groupId: string) => ({ groupId }),
  },
  expenses: {
    detail: (expenseId: string) => ({ expenseId }),
  },
  user: {
    profile: null,
    notifications: null,
  },
});
```

## Standard Query Hook

```typescript
import { useQuery } from '@tanstack/react-query';
import { queries } from '@/api/queryKeys';

export function useGroupExpenses(groupId: string) {
  return useQuery({
    queryKey: queries.groups.expenses(groupId).queryKey,
    queryFn: () => getGroupExpenses(groupId),
    staleTime: 5 * 60 * 1000,
    enabled: !!groupId,
  });
}
```

## Optimistic Mutation (required for expense create)

```typescript
export function useCreateExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newExpense: NewExpense) => createExpense(groupId, newExpense),

    onMutate: async (newExpense) => {
      await queryClient.cancelQueries({ queryKey: queries.groups.expenses(groupId).queryKey });
      const previous = queryClient.getQueryData(queries.groups.expenses(groupId).queryKey);

      queryClient.setQueryData(queries.groups.expenses(groupId).queryKey, (old: Expense[] = []) => [
        ...old,
        { ...newExpense, id: `temp-${Date.now()}`, status: 'pending' },
      ]);

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queries.groups.expenses(groupId).queryKey, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queries.groups.expenses(groupId).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.groups.balance(groupId).queryKey });
    },
  });
}
```

## Supabase Realtime Invalidation

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`expenses:${groupId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'expenses',
      filter: `group_id=eq.${groupId}`,
    }, () => {
      queryClient.invalidateQueries({ queryKey: queries.groups.expenses(groupId).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.groups.balance(groupId).queryKey });
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [groupId, queryClient]);
```

## Infinite Scroll (activity feed)

```typescript
export function useActivityFeed(groupId: string) {
  return useInfiniteQuery({
    queryKey: queries.groups.expenses(groupId).queryKey,
    queryFn: ({ pageParam = 0 }) => getExpenses(groupId, { offset: pageParam, limit: 20 }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === 20 ? pages.length * 20 : undefined,
    staleTime: 30 * 1000,
  });
}
```
