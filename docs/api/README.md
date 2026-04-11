# api-contracts.md
**Project:** Halvy — Next-Gen Social Expense Splitting Ecosystem
**Version:** 2.0
**Depends on:** schema.md, auth-flow.md, project-structure.md

> **v2.0 changes:** Removed `flagExpense`, `confirmSettlement`, `markSplitSettled`, `acknowledgeSettlement`, `giveRoutingConsent`. Removed `ExpenseStatus` enum. Removed `expense_splits` API entirely. Added `assignItems` to expenses. Added `payments.ts` module. Added `mentions` to messages. Updated Settlement type to reflect computed-only model.

---

## Assumptions & Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pagination | Cursor-based | Optimal for infinite scroll chat; no offset drift on live data |
| Error retry | 3 attempts with exponential backoff | Mobile networks are unreliable |
| Response casing | camelCase — transformed in API layer | Single consistent convention |
| Expense creation | One atomic call | No partial writes |
| Expense editing | Any group member, any time | Collaborative model; no time restriction |
| Expense deletion | Creator + admin/owner only | More consequential; restricted accordingly |
| Item assignment | Any group member, any time | Core collaborative feature |
| Settlements | Computed on-demand, never persisted | Live snapshot; no acknowledge flow |
| Payments | Written as ledger entries | Permanent facts; affect balances immediately |
| Message editing | Allowed within 15 minutes | Mirrors messaging app conventions |
| Initial message load | 50 messages | Balances speed with completeness |
| Real-time channels | Messages + balances + notifications | Covers all live moments |
| API layer rule | All Supabase calls in `src/api/` only | Screens and hooks never call Supabase directly |
| Rate limiting | Per-user, enforced at API layer | Prevents abuse |

---

## General Conventions

### camelCase Transformation

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

---

### Error Shape

```typescript
export type ApiResult<T> =
  | { data: T;    error: null     }
  | { data: null; error: ApiError }

export interface ApiError {
  code:    string
  message: string
  status?: number
}
```

---

### TanStack Query Global Config

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           1000 * 60 * 2,
      retry:               3,
      retryDelay:          (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry:      3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    }
  }
})
```

---

### Cursor-Based Pagination

```typescript
export interface PaginatedResponse<T> {
  data:       T[]
  nextCursor: string | null
  hasMore:    boolean
}
```

Cursors are ISO 8601 `created_at` timestamps used with `.lt('created_at', cursor)`.

---

## Rate Limits & Abuse Prevention

| Category | Action | Limit | Window | On Exceed |
|---|---|---|---|---|
| **Expenses** | `createExpense` | 30 per group | 1 hour | `RATE_LIMITED` |
| **Expenses** | `updateExpense` | 60 per group | 1 hour | `RATE_LIMITED` |
| **Messages** | `sendMessage` | 60 per group | 1 minute | `RATE_LIMITED` |
| **Messages** | `sendMessage` | 500 per group | 1 hour | `RATE_LIMITED` |
| **Reactions** | `addReaction` | 30 per message | 1 minute | Silently drop |
| **Payments** | `recordPayment` | 20 per group | 1 hour | `RATE_LIMITED` |
| **AI — OCR** | `callGemini` (OCR) | 20 per user | 1 hour | `AI_RATE_LIMITED` |
| **AI — Voice** | `callGemini` (voice) | 20 per user | 1 hour | `AI_RATE_LIMITED` |
| **AI — Total** | All Gemini calls | 50 per user | 24 hours | `AI_QUOTA_EXCEEDED` |
| **Invites** | `createInvite` | 5 per group | 1 hour | `RATE_LIMITED` |
| **Groups** | `createGroup` | 10 per user | 24 hours | `RATE_LIMITED` |

---

## API Modules

---

### `src/api/auth.ts`

```typescript
signIn(provider: 'google' | 'apple' | 'magic_link', email?: string): Promise<ApiResult<Session>>
signOut(): Promise<ApiResult<void>>
signOutAllDevices(): Promise<ApiResult<void>>
getSession(): Promise<ApiResult<Session | null>>
onAuthStateChange(callback: (session: Session | null) => void): Unsubscribe
```

---

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
interface User {
  id:               string
  email:            string
  displayName:      string
  avatarUrl:        string | null
  reliabilityScore: number
  authProvider:     'google' | 'apple' | 'magic_link'
  createdAt:        string
}
```

---

### `src/api/groups.ts`

```typescript
getGroups(): Promise<ApiResult<Group[]>>
getGroup(groupId: string): Promise<ApiResult<Group>>
createGroup(payload: CreateGroupPayload): Promise<ApiResult<Group>>
updateGroup(groupId: string, payload: UpdateGroupPayload): Promise<ApiResult<Group>>
deleteGroup(groupId: string): Promise<ApiResult<void>>
```

**Types:**
```typescript
type GroupType = 'dinner' | 'trip' | 'house'

interface Group {
  id:                      string
  name:                    string
  avatarUrl:               string | null
  groupType:               GroupType
  currency:                string
  ownerId:                 string
  assignmentTimeoutHours:  number   // configurable per group
  createdAt:               string
}

interface CreateGroupPayload {
  name:                    string
  avatarUrl?:              string
  groupType:               GroupType
  currency:                string
  assignmentTimeoutHours?: number  // defaults: dinner=2, trip/house=24
}

interface UpdateGroupPayload {
  name?:                   string
  avatarUrl?:              string
  assignmentTimeoutHours?: number
}
```

---

### `src/api/members.ts`

```typescript
getMembers(groupId: string): Promise<ApiResult<GroupMember[]>>
updateMemberRole(groupId: string, userId: string, role: MemberRole): Promise<ApiResult<GroupMember>>
removeMember(groupId: string, userId: string): Promise<ApiResult<void>>
transferOwnership(groupId: string, newOwnerId: string): Promise<ApiResult<void>>
```

**Types:**
```typescript
type MemberRole = 'owner' | 'admin' | 'member'

interface GroupMember {
  id:                     string
  groupId:                string
  userId:                 string | null
  placeholderId:          string | null
  role:                   MemberRole
  groupReliabilityScore:  number
  joinedAt:               string
}
```

---

### `src/api/invites.ts`

```typescript
createInvite(groupId: string): Promise<ApiResult<GroupInvite>>
validateInvite(token: string): Promise<ApiResult<GroupInvite>>
acceptInvite(token: string): Promise<ApiResult<GroupMember>>
revokeInvite(inviteId: string): Promise<ApiResult<void>>
getInvites(groupId: string): Promise<ApiResult<GroupInvite[]>>
```

---

### `src/api/placeholders.ts`

```typescript
createPlaceholder(groupId: string, displayName: string): Promise<ApiResult<Placeholder>>
claimPlaceholder(placeholderId: string): Promise<ApiResult<Placeholder>>
getPlaceholders(groupId: string): Promise<ApiResult<Placeholder[]>>
```

---

### `src/api/expenses.ts`

```typescript
getExpenses(groupId: string, cursor?: string): Promise<ApiResult<PaginatedResponse<Expense>>>
getExpense(expenseId: string): Promise<ApiResult<ExpenseDetail>>
createExpense(payload: CreateExpensePayload): Promise<ApiResult<ExpenseDetail>>
updateExpense(expenseId: string, payload: UpdateExpensePayload): Promise<ApiResult<ExpenseDetail>>
deleteExpense(expenseId: string): Promise<ApiResult<void>>
assignItems(expenseId: string, payload: AssignItemsPayload): Promise<ApiResult<ExpenseDetail>>
```

**Types:**
```typescript
type EntryMethod = 'manual' | 'ocr' | 'voice' | 'standing_order'

interface Expense {
  id:                   string
  groupId:              string
  creatorUserId:        string | null
  payerUserId:          string | null
  payerPlaceholderId:   string | null
  title:                string
  totalAmount:          number
  currency:             string
  entryMethod:          EntryMethod
  receiptImageUrl:      string | null
  messageId:            string | null
  createdAt:            string
  updatedAt:            string
  deletedAt:            string | null
}

interface ExpenseDetail extends Expense {
  lineItems:      LineItem[]
  lineItemSplits: LineItemSplit[]   // all assignments for this expense
  memberShares:   MemberShare[]     // computed shares per member (including tax/tip)
}

// Computed share — not a DB row, derived from lineItemSplits + tax/tip distribution
interface MemberShare {
  userId:        string | null
  placeholderId: string | null
  amount:        number
}

interface CreateExpensePayload {
  groupId:              string
  payerUserId?:         string
  payerPlaceholderId?:  string
  title:                string
  totalAmount:          number
  entryMethod:          EntryMethod
  receiptImageUrl?:     string
  lineItems:            CreateLineItemPayload[]
  // lineItemSplits are NOT required at creation — items start unassigned
}

interface UpdateExpensePayload {
  title?:           string
  totalAmount?:     number
  payerUserId?:     string
  receiptImageUrl?: string
  lineItems?:       CreateLineItemPayload[]  // full replacement
}

// Separate call for item assignment — any member, any time
interface AssignItemsPayload {
  assignments: LineItemAssignment[]
}

interface LineItemAssignment {
  lineItemId:     string
  assignees: {
    userId?:        string
    placeholderId?: string
    amount:         number   // their share of this item; must sum to item total
  }[]
}
```

**Notes:**
- `createExpense` is atomic — expense + line items saved in one transaction. No splits required at creation.
- `updateExpense` replaces `lineItems` entirely if provided. Callable by any group member.
- `deleteExpense` is a soft delete. Callable by creator or group admin/owner only.
- `assignItems` replaces all `line_item_splits` for the specified items atomically. Callable by any group member. Triggers balance recalculation and batched notifications to any member whose assignment was removed.
- There is no `flagExpense` or `confirmSettlement` — disputes are resolved by editing.

---

### `src/api/lineItems.ts`

```typescript
getLineItems(expenseId: string): Promise<ApiResult<LineItem[]>>
getLineItemSplits(expenseId: string): Promise<ApiResult<LineItemSplit[]>>
```

**Types:**
```typescript
interface LineItem {
  id:            string
  expenseId:     string
  description:   string
  amount:        number
  isTax:         boolean
  isTip:         boolean
  ocrConfidence: number | null
  position:      number
  createdAt:     string
}

interface LineItemSplit {
  id:            string
  lineItemId:    string
  expenseId:     string
  userId:        string | null
  placeholderId: string | null
  amount:        number
  createdAt:     string
  updatedAt:     string
}
```

**Notes:**
- Line items are written atomically via `createExpense` or `updateExpense`.
- Line item splits are written via `assignItems`. Never created individually.

---

### `src/api/payments.ts`

Payments are real-world transfers recorded between group members. They are permanent ledger entries that affect balances immediately.

```typescript
getPayments(groupId: string): Promise<ApiResult<Payment[]>>
recordPayment(payload: RecordPaymentPayload): Promise<ApiResult<Payment>>
deletePayment(paymentId: string): Promise<ApiResult<void>>
```

**Types:**
```typescript
interface Payment {
  id:                   string
  groupId:              string
  fromUserId:           string | null
  fromPlaceholderId:    string | null
  toUserId:             string | null
  toPlaceholderId:      string | null
  amount:               number
  currency:             string
  note:                 string | null
  messageId:            string | null
  createdAt:            string
  deletedAt:            string | null
}

interface RecordPaymentPayload {
  groupId:              string
  fromUserId?:          string
  fromPlaceholderId?:   string
  toUserId?:            string
  toPlaceholderId?:     string
  amount:               number
  note?:                string
}
```

**Notes:**
- `recordPayment` atomically creates a `payments` row and a `system_event` message: *"[from] paid [to] · {symbol}[amount]"*. The currency symbol is resolved per group currency using `fn_currency_symbol()` (e.g. `$25.00` for USD, `€25.00` for EUR). Currencies without a defined symbol fall back to their ISO code (e.g. `AED 25.00`).
- `deletePayment` is a soft delete. Callable by the payment creator or group admin/owner. Reverses the payment's balance contribution.
- There is no `acknowledgeSettlement` or `giveRoutingConsent` — payments are self-contained facts.

---

### `src/api/balances.ts`

Balances are always computed live. This module provides the read interface.

```typescript
getGroupBalances(groupId: string): Promise<ApiResult<GroupBalances>>
```

**Types:**
```typescript
interface MemberBalance {
  userId:        string | null
  placeholderId: string | null
  balance:       number   // positive = owed to them, negative = they owe
}

interface GroupBalances {
  groupId:  string
  members:  MemberBalance[]
  // Computed settlement suggestions — minimum transactions to zero all balances
  settlements: SettlementSuggestion[]
}

interface SettlementSuggestion {
  fromUserId:        string | null
  fromPlaceholderId: string | null
  toUserId:          string | null
  toPlaceholderId:   string | null
  amount:            number
}
```

**Notes:**
- Balances are the live net of all active `expenses` (via `line_item_splits`) and active `payments`.
- `settlements` in the response are computed suggestions only — they are never persisted. Call `recordPayment` to act on them.
- Subscribed via Realtime — balance updates broadcast to all group members after any expense or payment change.

---

### `src/api/messages.ts`

```typescript
getMessages(groupId: string, cursor?: string): Promise<ApiResult<PaginatedResponse<Message>>>
sendMessage(payload: SendMessagePayload): Promise<ApiResult<Message>>
editMessage(messageId: string, body: string): Promise<ApiResult<Message>>
deleteMessage(messageId: string): Promise<ApiResult<void>>
subscribeToMessages(groupId: string, onMessage: (msg: Message) => void): Unsubscribe
```

**Types:**
```typescript
type MessageType = 'user_text' | 'expense_card' | 'system_event' | 'expense_reply'

interface Message {
  id:              string
  groupId:         string
  senderUserId:    string | null
  messageType:     MessageType
  body:            string | null
  expenseId:       string | null
  paymentId:       string | null    // set for system_event messages about payments
  parentMessageId: string | null
  mentions:        Mention[]        // parsed @mentions in this message
  createdAt:       string
  editedAt:        string | null
}

interface Mention {
  mentionedUserId: string
  displayName:     string
}

interface SendMessagePayload {
  groupId:          string
  messageType:      MessageType
  body?:            string
  expenseId?:       string
  parentMessageId?: string
  // mentions are parsed server-side from body — not supplied by client
}
```

**Notes:**
- On `sendMessage`, the server parses `@mentions` from the body, creates `mentions` rows, and fires `mention` notifications to mentioned users.
- Mention notification body: *"[sender] mentioned you in [group name]"* — generic, no message content included.
- `editMessage` is allowed within 15 minutes of creation.

---

### `src/api/reactions.ts`

```typescript
addReaction(messageId: string, emoji: string): Promise<ApiResult<MessageReaction>>
removeReaction(messageId: string, emoji: string): Promise<ApiResult<void>>
getReactions(messageId: string): Promise<ApiResult<MessageReaction[]>>
```

---

### `src/api/notifications.ts`

```typescript
getNotifications(cursor?: string): Promise<ApiResult<PaginatedResponse<Notification>>>
markRead(notificationId: string): Promise<ApiResult<void>>
markAllRead(): Promise<ApiResult<void>>
subscribeToNotifications(onNotification: (n: Notification) => void): Unsubscribe
```

**Types:**
```typescript
type NotificationType =
  | 'expense_added'
  | 'expense_edited'
  | 'expense_deleted'
  | 'payment_recorded'
  | 'mention'
  | 'item_reassigned'
  | 'standing_order_fired'
  | 'standing_order_failed'
  | 'placeholder_claim_available'
  | 'group_invite'

interface Notification {
  id:               string
  userId:           string
  groupId:          string | null
  expenseId:        string | null
  paymentId:        string | null
  messageId:        string | null
  type:             NotificationType
  body:             string          // always generic
  isRead:           boolean
  createdAt:        string
}
```

**Notes:**
- All notification bodies are generic. The app never generates situation-specific copy.
- `item_reassigned` notifications are batched per 5-minute window per user per group.

---

### `src/api/standingOrders.ts`

```typescript
getStandingOrders(groupId: string): Promise<ApiResult<StandingOrder[]>>
createStandingOrder(payload: CreateStandingOrderPayload): Promise<ApiResult<StandingOrder>>
updateStandingOrder(orderId: string, payload: UpdateStandingOrderPayload): Promise<ApiResult<StandingOrder>>
deleteStandingOrder(orderId: string): Promise<ApiResult<void>>
toggleStandingOrder(orderId: string, isActive: boolean): Promise<ApiResult<StandingOrder>>
```

**Types:**
```typescript
type RecurrenceInterval = 'weekly' | 'monthly' | 'yearly'

interface StandingOrder {
  id:                   string
  groupId:              string
  createdByUserId:      string | null
  title:                string
  totalAmount:          number
  splitRule:            SplitRule
  recurrence:           RecurrenceInterval
  nextRunAt:            string
  lastRunAt:            string | null
  lastError:            string | null
  consecutiveFailures:  number
  isActive:             boolean
  createdAt:            string
}
```
