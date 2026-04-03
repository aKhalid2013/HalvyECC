# phasing-strategy.md
**Project:** Halvy — Next-Gen Social Expense Splitting Ecosystem
**Version:** 3.0
**Depends on:** All preceding documents

> **v2.0 changes:** Phase 3 deliverables updated — removed `splits.ts`, `markSplitSettled`, `acknowledgeSettlement`, `confirm_settlement`, `recalculate-settlements`, Settlements screen, flag trigger. Added `payments.ts`, `balances.ts`, `assignItems`, Assign Items panel, Activity tab, Settle sheet. Phase 5 Lane A updated — removed routing consent, settlement acknowledgment UX, confirmSettlement. Updated all exit criteria to reflect living ledger model.

> **v3.0 changes:** Removed reliability score from Phase 5 deliverables and exit criteria. Removed reliability score from Phase 5 Lane A lane description. Updated Avatar component note. Updated Phase overview description. Reliability scoring deferred to post-v1.

---

## Assumptions & Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Phase count | 5 | Granular enough for safe AI agent handoff; each phase independently testable |
| North star | Chat-first experience | Social layer must feel like a real messaging app before anything else |
| Phase gate | Every phase ends with a deployable staging build | No phase is complete until it compiles, tests pass, and staging build is live |
| Dependency order | Schema → Auth → Chat → Expenses → AI → Payments & Polish | Each layer depends on the one below |
| Agent handoff | Each phase has a self-contained task list | Agents execute one phase at a time; never skip ahead |
| Phase 4/5 parallelism | Explicitly defined parallel lanes | Payment polish and profile screens can begin before AI entry is complete |

---

## Phase Overview

| Phase | Name | Primary Goal | Staging build |
|---|---|---|---|
| 1 | Foundation | Project skeleton, DB, auth working end-to-end | ✅ |
| 2 | Groups & Chat | Real-time chat feels like a messaging app | ✅ |
| 3 | Expenses & Balances | Expense creation, collaborative assignment, live balances, debt graph | ✅ |
| 4 | AI Entry | OCR and voice dictation working reliably | ✅ |
| 5 | Payments & Polish | Payment recording, full loop, production readiness | ✅ |

---

## Phase 1 — Foundation
**Goal:** Project runs on all three platforms, database is live, users can sign in and see an empty home screen.

### Deliverables

**Infrastructure**
- [ ] Expo project initialised with Expo Router v3, TypeScript strict, NativeWind
- [ ] `@` alias configured in `tsconfig.json`
- [ ] `.env` + `.env.example` in place, `.gitignore` updated
- [ ] `app.config.ts` reading all environment variables
- [ ] `src/constants/config.ts` typed config helper with startup validation
- [ ] Jest + React Native Testing Library configured
- [ ] `eas.json` with development, staging, production profiles
- [ ] EAS secrets set for all three environments

**Database**
- [ ] Supabase dev project created
- [ ] All migrations from `schema.md` v3.0 applied (`supabase/migrations/00001_initial_schema.sql`)
- [ ] `group_invites` table added (from `auth-flow.md`)
- [ ] `rate_limits` table added (from `api-contracts.md`)
- [ ] `ai_budget` table added (from `ai-integration.md`)
- [ ] Row-level security policies applied for all tables
- [ ] `src/types/database.ts` generated via `supabase gen types`
- [ ] `src/types/models.ts` app-level types derived from DB types
- [ ] Seed data in `supabase/seed.sql` (2 test users, 1 group, 3 expenses with line items)
- [ ] `supabase/MIGRATION_LOG.md` created

**Auth**
- [ ] Supabase Auth configured (Google OAuth, Apple OAuth, Magic Link)
- [ ] `src/api/client.ts` — Supabase singleton with SecureStore adapter
- [ ] `src/api/auth.ts` — signIn, signOut, signOutAllDevices, getSession, onAuthStateChange
- [ ] `src/stores/authStore.ts` — Zustand store
- [ ] `src/providers/AuthProvider.tsx`
- [ ] `src/providers/QueryProvider.tsx`
- [ ] Auth gate in `app/_layout.tsx`
- [ ] `app/(auth)/sign-in.tsx` — Google, Apple, Magic Link buttons
- [ ] `app/(auth)/magic-link.tsx` — confirmation screen with resend
- [ ] `app/index.tsx` — entry redirect logic
- [ ] `src/api/users.ts` — getUser, getCurrentUser, updateUser, deleteUser, reactivateUser
- [ ] DB trigger: new `auth.users` row → insert into `public.users`
- [ ] Multi-provider email merge working

**Design System (tokens only)**
- [ ] `src/constants/colors.ts` — palette + light/dark semantic tokens + `useTheme()`
- [ ] `src/constants/typography.ts`
- [ ] `src/constants/spacing.ts`
- [ ] `src/constants/radius.ts`
- [ ] `src/constants/shadows.ts`

**Core Shared Components**
- [ ] `src/components/Avatar.tsx` — user avatar with optional role badge
- [ ] `src/components/BalanceChip.tsx` — positive/negative/zero variants
- [ ] `src/components/Button.tsx` — primary, secondary, danger, ghost
- [ ] `src/components/Input.tsx`
- [ ] `src/components/Card.tsx`
- [ ] `src/components/Modal.tsx` — bottom sheet wrapper
- [ ] `src/components/EmptyState.tsx`
- [ ] `src/components/ReconnectingBanner.tsx`

### Phase 1 Exit Criteria
```
□ npx tsc --noEmit passes
□ npx jest passes
□ App launches on iOS, Android, and web without errors
□ Google OAuth sign-in works end-to-end on device
□ Magic Link sign-in works end-to-end
□ Signed-in user sees empty home screen
□ Signed-out user is redirected to sign-in
□ EAS staging build deploys successfully
```

---

## Phase 2 — Groups & Chat
**Goal:** Real-time chat feels like a messaging app. Groups can be created, members invited, messages sent.

### Deliverables

**Groups & Members API + Hooks**
- [ ] `src/api/groups.ts` — all functions including `assignmentTimeoutHours` field
- [ ] `src/api/members.ts` — all functions
- [ ] `src/api/invites.ts` — all functions
- [ ] `src/api/placeholders.ts` — all functions
- [ ] `src/features/groups/hooks/useGroups.ts`
- [ ] `src/features/groups/hooks/useGroup.ts`
- [ ] `src/features/groups/hooks/useGroupMutations.ts`
- [ ] `src/features/groups/hooks/useMembers.ts`

**Messages API + Hooks**
- [ ] `src/api/messages.ts` — all functions; sendMessage parses @mentions server-side
- [ ] `src/api/reactions.ts` — all functions
- [ ] `src/api/notifications.ts` — all functions
- [ ] `src/features/chat/hooks/useMessages.ts`
- [ ] `src/features/chat/hooks/useChatSubscription.ts` — Realtime messages channel
- [ ] `src/features/notifications/hooks/useNotifications.ts`

**Real-time Provider**
- [ ] `src/providers/RealtimeProvider.tsx` — manages `messages:{groupId}` and `balances:{groupId}` subscriptions

**Chat Components**
- [ ] `src/features/chat/components/MessageBubble.tsx` — outgoing, incoming, system event; @mention highlight rendering
- [ ] `src/features/chat/components/SystemEvent.tsx`
- [ ] `src/features/chat/components/ReactionBar.tsx`
- [ ] `src/features/chat/components/ChatInput.tsx` — text input + [+] button + @mention inline picker

**Group Feature Components**
- [ ] `src/features/groups/components/GroupCard.tsx` — avatar, name, last message, balance chip, unread dot
- [ ] `src/features/groups/components/GroupTypeSelector.tsx`

**Screens**
- [ ] `app/(app)/groups/index.tsx` — groups list, FAB, deep link join flow
- [ ] `app/(app)/groups/new.tsx` — create group modal, group type, assignment timeout field
- [ ] `app/(app)/groups/[groupId]/index.tsx` — group chat with 3 inner tabs: Chat / Activity / Settle
- [ ] `app/(app)/groups/[groupId]/settings.tsx` — group info, assignment timeout setting, members, invite link, recurring expenses, danger zone
- [ ] `app/(app)/notifications/index.tsx` — notifications list, tap destinations

**DB Triggers**
- [ ] Owner transfer trigger
- [ ] Mention notification trigger (INSERT on `mentions` → notification for mentioned user)

### Phase 2 Exit Criteria
```
□ npx tsc --noEmit passes
□ npx jest --coverage passes
□ User can create a group (Dinner, Trip, House) with configurable assignment timeout
□ User can invite another user via deep link
□ Both users see same chat thread in real time (< 2 seconds)
□ @mention renders highlighted in chat; mentioned user receives notification
□ ReconnectingBanner appears on network loss
□ Swipe-back gesture works on iOS
□ Group settings shows assignment timeout field (editable)
□ Invite link preview works for unauthenticated users
□ EAS staging build deploys successfully
```

---

## Phase 3 — Expenses & Balances
**Goal:** The core financial loop works. Users can add expenses, collaboratively assign items, and see live balances.

### Deliverables

**Expenses API + Hooks**
- [ ] `src/api/expenses.ts` — createExpense, updateExpense, deleteExpense, assignItems
- [ ] `src/api/balances.ts` — getGroupBalances, getSettlementSuggestions
- [ ] `src/api/payments.ts` — recordPayment, deletePayment
- [ ] `src/features/expenses/hooks/useExpenses.ts`
- [ ] `src/features/expenses/hooks/useExpense.ts`
- [ ] `src/features/expenses/hooks/useExpenseMutations.ts`
- [ ] `src/features/expenses/hooks/useGroupBalances.ts`

**Split Calculator**
- [ ] `src/features/expenses/utils/splitCalculator.ts` — all split types + largestRemainder + proportional tax/tip
- [ ] `src/features/expenses/utils/splitCalculator.test.ts` — all test cases from `testing-strategy.md`
- [ ] `src/features/expenses/utils/debtGraph.ts` — simplifyDebts algorithm
- [ ] `src/features/expenses/utils/debtGraph.test.ts`

**Expense Components**
- [ ] `src/features/expenses/components/ExpenseCard.tsx` — compact + expanded states, ⋯ menu
- [ ] `src/features/expenses/components/AssignItemsPanel.tsx` — bottom sheet, item list, assignee picker
- [ ] `src/features/expenses/components/BalanceStrip.tsx` — horizontal scroll, member avatars, BalancePill
- [ ] `src/features/expenses/components/ActivityFeed.tsx` — financial events only

**Expense Creation — Manual Flow**
- [ ] `app/(app)/expense/new.tsx` — entry method picker
- [ ] Manual form: title, amount, payer, line items, split type
- [ ] Draft persistence: auto-save every 500ms, restore prompt on reopen
- [ ] On post: `createExpense` → card injected into chat, items unassigned

**Expense Edit + Delete**
- [ ] `app/(app)/expense/[expenseId]/edit.tsx` — full-screen modal, any member
- [ ] Delete confirmation dialog — balance impact preview

**Settle Sheet**
- [ ] Settle tab + bottom sheet — balance grid, settlement suggestions, record payment
- [ ] `recordPayment` → system message → live balance update

**DB Triggers**
- [ ] System message on expense create / edit / delete
- [ ] System message on payment record
- [ ] Item reassignment notification trigger (batched 5-min window)
- [ ] Balance Realtime broadcast trigger

### Phase 3 Exit Criteria
```
□ npx tsc --noEmit passes
□ npx jest --coverage passes (80% on splitCalculator and debtGraph)
□ All splitCalculator test cases pass
□ All debtGraph test cases pass
□ Manual expense creation: form → card in chat, items unassigned
□ Assign items: any member assigns → balance updates live
□ Edit expense: any member edits → balances update → system message posted
□ Delete expense: creator/admin deletes → balance reversal → card struck through
□ Settle tab: shows correct minimum transfers given current balances
□ Record payment: system message posted → balances recalculate → settle tab updates
□ Activity tab: shows expenses and payments only (no chat messages)
□ EAS staging build deploys successfully
```

---

## Phase 4 — AI Entry
**Goal:** OCR and voice dictation work reliably. Receipts scan accurately. Voice produces correct expense previews.

### Deliverables

**AI Infrastructure**
- [ ] `src/features/ai/utils/geminiClient.ts` — single wrapper; all Gemini calls go through here
- [ ] `src/features/ai/utils/memberMatcher.ts` — fuzzy name matching against group display names
- [ ] `memberMatcher.test.ts` — fuzzy match test cases (exact, partial, ambiguous, no match)
- [ ] `src/features/ai/utils/budgetTracker.ts` — per-user hourly + daily cap enforcement

**AI Hooks**
- [ ] `src/features/ai/hooks/useOCR.ts` — full state machine (idle → capturing → processing → retrying → preview → failed → rate_limited)
- [ ] `src/features/ai/hooks/useVoiceDictation.ts` — full state machine
- [ ] `useOCR.test.ts` — all state transitions
- [ ] `useVoiceDictation.test.ts`

**Expense Creation — OCR Flow**
- [ ] Camera capture UI (viewfinder, capture, multi-image up to 3)
- [ ] Processing loading state (animated logo)
- [ ] OCR preview — editable line items, confidence highlights, total mismatch warning
- [ ] Auto-retry once on extraction failure, fall back to manual on second failure
- [ ] Rate limit handling: toast + manual entry fallback
- [ ] On confirm → `createExpense` called → card posted to chat with items **unassigned**
- [ ] No split assignment step during creation; assignment happens collaboratively in chat

**Expense Creation — Voice Flow**
- [ ] Hold-to-record mic UI
- [ ] Processing loading state
- [ ] Voice preview — one ExpenseCard per parsed expense, editable, unresolved name pickers
- [ ] Confirm all → `createExpense` for each → cards posted with items **unassigned**
- [ ] Error handling: parse failure toast, rate limit toast

**Permissions**
- [ ] Camera permission request flow
- [ ] Microphone permission request flow

### Phase 4 Exit Criteria
```
□ npx tsc --noEmit passes
□ npx jest --coverage passes
□ memberMatcher fuzzy tests all pass
□ useOCR and useVoiceDictation state machine tests all pass
□ OCR: photograph receipt → correct line items extracted → expense posted with items unassigned
□ OCR: items appear in chat ready for collaborative assignment (no split assignment step in creation)
□ OCR: low-confidence item shown with amber highlight
□ OCR: failed extraction retries once then falls back to manual
□ Voice: dictate expense → correct preview generated → posted unassigned
□ Voice: multiple expenses in one dictation → multiple cards posted
□ AI budget tracking increments on every call
□ EAS staging build deploys successfully
□ Maestro flows: create_ocr.yaml and create_voice.yaml pass
```

---

## Phase 5 — Payments & Polish
**Goal:** The full loop from expense to zero balance feels frictionless. App is polished and production-ready.

### Phase 4/5 Parallel Lanes

#### Lane A — Can start immediately after Phase 3:
- Payment UX polish (record payment flow, system messages, balance update animations)
- Profile and settings screens
- Push notification setup
- Design polish (animations, dark mode, accessibility)
- Error boundaries and empty states
- Production Supabase setup

#### Lane B — Blocked until Phase 4 exit criteria are met:
- Final Maestro E2E suite (all 5 flows including OCR and voice)
- Budget monitoring validation in production
- Phase 5 completion sign-off

### Deliverables

**Payment Flow Polish (Lane A)**
- [ ] Record Payment bottom sheet — confirms amount, optional note field
- [ ] System message posted on payment: *"[from] paid [to] · $[amount]"*
- [ ] Settle tab recalculates immediately after payment recorded
- [ ] Balance strip animates to reflect new values
- [ ] `balances:{groupId}` Realtime channel verified working end-to-end
- [ ] Payment appears in Activity tab instantly

**Reliability Score (Deferred)**
> User reputation and reliability scoring is deferred to post-v1. No implementation in this phase. The model for what behaviours to credit and the scoring mechanism are still being defined.

**Profile & Settings (Lane A)**
- [ ] `app/(app)/profile/index.tsx` — hero, stats (groups joined, total paid), account menu
- [ ] `app/(app)/profile/settings.tsx` — account settings, notification preferences, delete account flow

**Notifications Polish (Lane A)**
- [ ] Push notification setup via Expo Notifications + EAS
- [ ] All notification types from `schema.md` v3.0 fire correctly
- [ ] Notification tap → correct deep link destination per type
- [ ] Unread badge on Notifications tab updates in real time
- [ ] `item_reassigned` batching verified (5-min window collapses multiple into one)

**Design Polish (Lane A)**
- [ ] All Reanimated animations per `design-system.md` Section 9
- [ ] Dark mode tested on all screens
- [ ] Accessibility audit: `accessibilityLabel` on all interactive elements, 44×44px touch targets
- [ ] `AccessibilityInfo.isReduceMotionEnabled` check — skip animations if true
- [ ] Empty states on all screens
- [ ] Error boundaries on all tab roots
- [ ] Priority wireframes created

**Final Testing (Lane B)**
- [ ] All 5 Maestro E2E flows passing on staging
- [ ] `npx jest --coverage` ≥80% on all covered paths
- [ ] Full agent completion checklist verified for every screen

**Production Readiness (Lane A setup, Lane B sign-off)**
- [ ] Production Supabase project created and migrations applied
- [ ] EAS production secrets set
- [ ] AI budget monitoring validated (70%/90% alerts)
- [ ] `eas build --profile production --platform all` succeeds
- [ ] App Store Connect and Google Play Console apps created
- [ ] Privacy policy and terms of service URLs configured

### Phase 5 Exit Criteria
```
□ npx tsc --noEmit passes
□ npx jest --coverage ≥80% on all covered paths
□ All Phase 4 exit criteria met
□ All 5 Maestro E2E flows pass on staging
□ Full expense lifecycle end-to-end:
    Add expense (any method) → card in chat, items unassigned →
    members assign items → balances update live →
    settle tab shows correct transfers → record payment →
    system message posted → balances recalculate → settle tab updates
□ Edit expense: any member edits → balances update immediately → system message posted
□ Delete expense: creator/admin deletes → balance reversal correct → card struck through
□ Push notifications received on device for all notification types
□ item_reassigned notification batching confirmed (multiple reassignments → single notification)
□ Activity tab shows only expenses and payments (not chat messages)
□ @mention: typed in chat → highlighted → mentioned user receives push notification
□ Dark mode correct on all screens
□ Reduced motion preference respected
□ Standing order: fires on schedule → expense card posted → items unassigned
□ Standing order failure auto-pause and admin notification work
□ EAS production build succeeds iOS and Android
□ Web deploy to EAS hosting succeeds
```

---

## Dependency Map

```
Phase 1 (Foundation)
  └── Phase 2 (Groups & Chat)
        └── Phase 3 (Expenses & Balances)
              ├── Phase 4 (AI Entry)
              │     └── Phase 5 Lane B (final testing, completion sign-off)
              └── Phase 5 Lane A (payments, profile, polish, production)
                    └── Phase 5 Lane B (blocked until Phase 4 + Lane A both complete)
```

---

## Agent Handoff Rules

1. **Read before writing.** Before implementing any feature, read the relevant documents. Do not infer behaviour from context alone.
2. **One phase at a time** (with explicit parallel exception for Phase 5 Lane A after Phase 3).
3. **Tests first for business logic.** For any file in `src/features/**/utils/` or `src/api/`, write the test file before implementation.
4. **Run the exit criteria checklist** before declaring a phase complete.
5. **Never skip the staging build.** A phase is not complete until `eas build --profile staging` succeeds on a real device or simulator.
6. **Schema changes go through migrations.** Never edit the database directly. New migration file + regenerate `src/types/database.ts` + update `MIGRATION_LOG.md`. Every migration must include a DOWN rollback section.
7. **Secrets never in code.** Add to `.env.example`, document in `env-and-config.md`, set via `eas secret:create`.
8. **Flag missing wireframes.** Note any screen without a wireframe in the completion checklist.
