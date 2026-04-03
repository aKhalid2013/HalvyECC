# screens-and-navigation.md
**Project:** Halvy — Next-Gen Social Expense Splitting Ecosystem
**Version:** 5.0
**Depends on:** project-structure.md, auth-flow.md, design-system.md, schema.md

> **v2.0 changes:** Removed Settlements tab from bottom nav. Added Activity tab inside group chat. Added Assign Items panel. Removed flag/dispute UI. Added @mention support.

> **v3.0 changes:** Removed reliability score badge from member balance strip and group settings. Removed reliability score from profile screen. Reliability scoring deferred to post-v1.

> **v4.0 changes:** Added placeholder creation flows. Added placeholder visual spec. Updated group settings members section. Added placeholder claiming screen. Clarified Activity Tab as group-scoped financial history. Clarified Notifications screen as cross-group personal inbox. Added onboarding deferred note.

> **v5.0 changes:** Added Standing Order as a fourth entry method in the + button picker. Added Standing Order creation screen (full spec). Updated group settings Recurring Expenses section with full row spec, active toggle, error state, and edit/delete actions. Added Standing Order Edit sheet. Updated + button entry method picker. Updated Screen × Data table with `useStandingOrders`. Updated Expense Card to show 🔁 recurring icon for standing_order entry method.

---

## Assumptions & Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tab count | 3 (Groups, Notifications, Profile) | Settlements moved inside group chat — no dedicated tab needed |
| Chat navigation | Pushed onto groups stack, tab bar hidden | Full-height chat; matches WhatsApp/Telegram pattern |
| Group chat tabs | Chat / Activity / Settle (inside group) | All group context in one place |
| Activity tab scope | Group-scoped financial history only | Distinct from Notifications tab — no alerts, no cross-group events |
| Notifications tab scope | Cross-group personal inbox | Personal alerts only — mentions, reassignments, invites, standing order events |
| Expense card actions | ⋯ menu (Assign, Edit, Reply, Delete) | Clean; separates viewing from acting |
| Item assignment | Bottom sheet panel, any member | Core collaborative interaction |
| Settle view | Bottom sheet triggered from chat header | On-demand snapshot; not a persistent destination |
| Placeholder visual | Grayed-out avatar with initials | Consistent signal across all surfaces; no badge needed |
| Placeholder creation | 3 entry points: group creation, settings, inline assignment | Low friction at every natural moment |
| Placeholder edit | Owner/admin only | Prevents abuse; any member can create, restricted can edit |
| Placeholder claiming | Auto-suggest on signup + manual confirmation | Reduces friction while keeping user in control |
| Standing order entry | Via + button in chat (4th method) | Natural home alongside other entry methods |
| Standing order split mode | Chosen at creation: fixed or collaborative | Fixed needs no per-cycle action; collaborative mirrors manual expense |
| Standing order history | Past expenses appear in chat/activity like any other | No dedicated history view — the chat is the record |
| Standing order pause | Any group member | Reversible; any member should be able to stop a recurring charge |
| Standing order delete | Owner/admin only | Permanent action; warrants elevated permission |
| Onboarding walkthrough | Deferred to post-v1 | Best designed once real screens exist |
| Expense draft persistence | Auto-save on mobile, in-memory on web | Prevents data loss |

---

## 1. Navigation Graph

```
Root (_layout.tsx)
│
├── (auth)/
│   ├── sign-in
│   └── magic-link
│
└── (app)/                          # Authenticated — tab bar visible
    ├── Tab 1: groups/
    │   ├── index                   # Groups list [TAB ROOT]
    │   ├── new                     # Create group (modal) — includes placeholder creation
    │   └── [groupId]/
    │       ├── index               # Group chat — 3 inner tabs: Chat / Activity / Settle
    │       └── settings            # Group settings + members + placeholders + standing orders [modal]
    │
    ├── Tab 2: notifications/
    │   └── index                   # Cross-group personal inbox [TAB ROOT]
    │
    └── Tab 3: profile/
        ├── index                   # User profile
        └── settings                # Account settings

    Modals (rendered above all tabs):
    ├── expense/new                 # Expense creation — OCR/voice/manual/standing order
    ├── expense/[expenseId]/edit    # Expense edit screen
    └── claim/index                 # Placeholder claiming — shown post-signup if matches found
```

---

## 2. Expo Router File Structure

```
app/
├── _layout.tsx
├── index.tsx
│
├── (auth)/
│   ├── _layout.tsx
│   ├── sign-in.tsx
│   └── magic-link.tsx
│
└── (app)/
    ├── _layout.tsx
    ├── groups/
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── new.tsx
    │   └── [groupId]/
    │       ├── _layout.tsx
    │       ├── index.tsx
    │       └── settings.tsx
    ├── notifications/
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── profile/
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   └── settings.tsx
    ├── expense/
    │   ├── new.tsx
    │   └── [expenseId]/
    │       └── edit.tsx
    └── claim/
        └── index.tsx
```

---

## 3. Groups List Screen

**Route:** `/(app)/groups`
**Header:** "Halvy" (brand, h1) + [+ New Group] button

```
Balance summary card (top):
  - Total balance across all groups (amountLg)
  - "across N active groups" (caption)

Groups list:
  Each group row:
    - Group avatar (emoji or image)
    - Group name (bodyMd, bold)
    - Last activity (caption, textSecondary) + time (caption, right)
    - Net balance chip (BalancePill — positive/negative/balanced)
    - Unread badge if unread messages

Empty state:
  - Icon + "No groups yet"
  - [Create a group] button primary
```

---

## 4. Create Group Screen

**Route:** `/(app)/groups/new`
**Presentation:** Full-screen modal

```
[← Cancel]  New Group  [Create]

Group avatar picker (emoji or image upload)
Group name input
Group type selector: [Dinner]  [Trip]  [House]
Assignment timeout (pre-filled by group type, editable)

Members section:
  - Search bar: "Add people"
  - Results show existing Halvy users (by name or contact)
  - [+ Add someone not on Halvy] → opens Add Placeholder sheet

Added members list:
  Each row:
    - Avatar (or grayed initials for placeholder)
    - Name
    - [×] remove

[Create Group] button primary
```

**Add Placeholder sheet:**
```
[── handle bar ──]
Add Someone Without Halvy

Name input (required)
Phone or Email input (optional)
  Caption: "Used to match them when they sign up"

[Add to Group]
```

---

## 5. Group Chat Screen

**Route:** `/(app)/groups/[groupId]`
**Header:** Group name + member count + [⚡ Settle] button
**Tab bar:** Hidden (full-height chat)

### 5.1 Header

```
[← back]  [Group avatar] [Group name]  [⚡ Settle]
           [Member count / group type]
```

### 5.2 Member Balance Strip

Horizontally scrollable strip directly below the header:

```
[Avatar]       [Avatar]       [Grayed initials]  [Avatar]
[Name]         [Name]         [Name]             [Name]
[BalancePill]  [BalancePill]  [BalancePill]      [BalancePill]
```

- Real members: normal colored avatar
- Placeholder members: grayed-out avatar with initials
- **BalancePill:** positive (green, +$X), negative (red, −$X), balanced (grey)
- Balances update live via Realtime subscription

### 5.3 Inner Tab Bar

| Tab | Contents |
|---|---|
| 💬 Chat | Full message thread — chat bubbles + expense cards + system events |
| 📋 Activity | Group-scoped financial history — expenses and payments only |
| ⚡ Settle | Current balances + settlement suggestions + record payment |

---

### 5.4 Chat Tab

**Message types rendered in thread:**

| Type | Render |
|---|---|
| `user_text` | Chat bubble (outgoing right, incoming left) |
| `expense_card` | ExpenseCard component — full width, compact default |
| `system_event` | Centered italic caption |
| `expense_reply` | Chat bubble with quoted expense preview above |

**Chat input bar (pinned bottom):**
```
[+]  [Message input — "Message… or @mention"]  [Send]
```

**[+] button opens entry method picker:**
```
┌─────────────────────────────┐
│  📷  Scan Receipt           │
│  🎙️  Voice Entry            │
│  ✏️  Manual Entry           │
│  🔁  Recurring Expense      │
└─────────────────────────────┘
```

- **@mention:** Typing `@` opens inline member picker. Placeholders appear with grayed initials. Mentions of placeholders do not trigger notifications.
- **Send:** Enabled when input is non-empty.

---

### 5.5 Expense Card Component

**Compact state:**
```
[Icon] [Title]              [status chip]  [$Total]
       [Paid by Name · method icon]        [your share $X]
       [─────────────── progress bar ──────] N%
       "Tap to assign items & view shares ↓"
       [⋯ menu button — top right]
```

- **method icon:** 📷 for OCR, 🎙️ for voice, ✏️ for manual, 🔁 for standing order
- The 🔁 icon signals to members that this is an automated recurring expense

**Expanded state:**
```
[Compact header]

Items section:
  Each item row:
    [Description]  [⚠ confidence]  [$amount]
    [Assignee chips: Name $X  Name $X]
    "Unassigned → stays on [payer]" (if no assignees)

Shares section:
  Each member (real or placeholder) with a share:
    [Avatar / grayed initials] [Name]  [$share]
```

**⋯ Menu:**

| Action | Available to | Behaviour |
|---|---|---|
| ✋ Assign Items | Any member | Opens Assign Items panel |
| ✏️ Edit Expense | Any member | Opens expense edit screen |
| 💬 Reply | Any member | Pre-fills chat input with reply context |
| 🗑️ Delete | Creator + admin/owner | Opens delete confirmation dialog |

---

### 5.6 Assign Items Panel

Opens as a bottom sheet from ⋯ menu → Assign Items.

**Item list:**
```
[Description]                    [$amount]
[Assignee chip: Name $X] [+ Add assignee]
```

- Tapping an unassigned item assigns it to the current user immediately
- [+ Add assignee] opens member picker with real members + placeholders (grayed initials)
- **[+ Add someone not on Halvy]** at bottom of member picker — creates placeholder inline
- Tax and tip rows are non-assignable — distributed automatically

**Footer:**
```
[N of M items assigned]
[Done]
```

---

### 5.7 Activity Tab

**Purpose:** Group-scoped financial history. Not an alert inbox.

**Events shown:**
- Expenses added / edited / deleted (tag: expense)
- Payments recorded (tag: payment)
- Recurring expenses fired (tag: expense + 🔁 icon)

**Not shown:** Chat messages, @mentions, non-financial system events, events from other groups.

**Each row:**
```
[Icon]  [Event description]        [$amount]
        [Group member name · time]
```

**Empty state:**
```
No financial activity yet.
Expenses and payments will appear here.
```

---

### 5.8 Settle Tab / Sheet

```
[Header: "Settle Up" · "N transfers needed · minimum possible"]

Member balance grid (real members + placeholders):
  [Avatar / grayed initials] [Name] [BalancePill]

Settlement suggestions:
  [From avatar] → [To avatar]  [Name → Name]  [$amount]
  [Record Payment] — current user is "From" only
  Note: if "From" is a placeholder, Record Payment shown to owner/admin only

Info callout:
  "⚡ Always up to date — recalculates as items are assigned or payments recorded"
```

**Record Payment flow:** Immediate — no extra modal. System message posted. Balances recalculate live.

---

### 5.9 Expense Creation Screen

**Route:** `/(app)/expense/new?method=ocr|voice|manual|standing_order&groupId=[id]`
**Presentation:** Full-screen modal

**Method: OCR**
```
Step 1 — Capture → Step 2 — Processing → Step 3 — AI Preview → Step 4 — Confirm + Post
```

**Method: Voice**
```
Step 1 — Record → Step 2 — Processing → Step 3 — Preview → Confirm all → Post
```

**Method: Manual**
```
Title · Amount · Payer picker · [Add line items] · [Post Expense]
```

**Method: Standing Order (Recurring Expense)**

Full-screen modal with a dedicated creation form — see Section 5.10 below.

All one-off methods post a card with items unassigned. Draft auto-saves every 500ms on mobile.

---

### 5.10 Standing Order Creation Screen

**Route:** `/(app)/expense/new?method=standing_order&groupId=[id]`
**Presentation:** Full-screen modal
**Available to:** Any group member

```
[← Cancel]  Recurring Expense  [Save]

Title input
  e.g. "Netflix", "Monthly Rent", "Weekly Groceries"

Amount input (numeric)

Payer picker
  Single select — defaults to current user
  Includes placeholders (grayed initials)

Recurrence
  [Every] [___] [Day / Week / Month / Year]
  e.g. "Every 2 Weeks" or "Every 1 Month"

First run date
  Date picker — user explicitly chooses when the first expense fires
  Caption: "First expense will be added on this date"

Split mode
  [○] Collaborative — members assign items in chat each time
  [○] Fixed — set the split now, applies automatically every time

  — if Fixed is selected, show split rule builder:
    Split type selector: Equal / Percentage / Fixed amount
    Member rows with amount/percentage inputs
    Validation: must sum to total amount
    Caption: "This split will apply automatically each time"

[Save Recurring Expense]
```

On save:
- Standing order row created in DB
- System message posted to chat: *"[creator] set up a recurring expense: [title] · every [N] [unit]"*
- First firing is scheduled for `first_run_at` — nothing fires immediately on save

---

### 5.11 Expense Edit Screen

**Route:** `/(app)/expense/[expenseId]/edit`
**Presentation:** Full-screen modal
**Available to:** Any group member

```
[← Cancel]  Edit Expense  [Save]

Title · Payer picker · Amount · Line items · [Save Changes]
```

On save: balances recalculate, system message posted, generic notification sent to all members.

---

### 5.12 Delete Confirmation Dialog

```
🗑️  "Delete expense?"
"[Title] ($X) will be removed and balances will update."

Balance impact preview: [Avatar] Name  +/-$X

[Keep it]   [Delete]
```

---

## 6. Group Settings Screen

**Route:** `/(app)/groups/[groupId]/settings`
**Presentation:** Full-screen modal

```
Section: Group Info
  - Avatar picker
  - Group name input
  - Group type (read-only)
  - Assignment timeout: "Items auto-lock after: [2h / 24h / custom]"
    Caption: "Members are notified 30 min before auto-lock"

Section: Members
  Real member rows:
    - Avatar + display name + role chip + BalancePill
    - Long press → Promote / Remove (owner only)

  Placeholder rows:
    - Grayed initials avatar + display name + "(Not on Halvy)" caption + BalancePill
    - Invite nudge (owner/admin only): "Invite [Name] to claim their balance" → share link
    - Long press (owner/admin only) → Edit placeholder / Record payment / Remove

  [+ Add member] → search for Halvy users or create placeholder

Section: Invite Link
  - Copyable link + expiry
  - [Copy] [Share] [Revoke]

Section: Recurring Expenses
  Each standing order row:
    [🔁] [Title]                          [Every N unit]
         Next: [date]          [Active toggle]
         [⚠ Error — tap to view] — shown if last_error is set, owner/admin only

  Row actions (tap row to open Standing Order Edit sheet):
    - Any member: edit title, amount, recurrence, split mode, toggle active
    - Owner/admin only: delete

  [+ Add Recurring Expense] → opens Standing Order Creation screen

Section: Danger Zone (owner only)
  - [Leave Group]
  - [Delete Group]
```

**Standing Order Edit sheet (bottom sheet, opens on row tap):**
```
[── handle bar ──]
[🔁 Title]  [Active toggle — right]        [×]

Title input
Amount input
Payer picker
Recurrence: [Every] [___] [Day / Week / Month / Year]
Split mode: [Collaborative ○] [Fixed ○]
  — if Fixed: split rule builder (same as creation)

Next run: [date display]
  Caption: "Editing does not affect expenses already posted"

[Save Changes]
[Delete Recurring Expense] — destructive, owner/admin only
  → Confirmation: "This will stop all future firings. Past expenses remain."
  → [Cancel] [Delete]
```

**Error state on standing order row (owner/admin only):**
```
[🔁] [Title]                       [Every N unit]
     Next: Paused — 3 failures     [Active toggle — off]
     ⚠ "Failed 3 times — tap to review and re-activate"
```

Tapping the error row opens the Edit sheet. Owner/admin fixes the issue and toggles Active back on to resume.

---

**Edit Placeholder sheet (owner/admin only):**
```
[── handle bar ──]
Edit Placeholder

Name input
Phone or Email input
  Caption: "Used to match them when they sign up for Halvy"

[Save]
```

**Record Payment for Placeholder sheet (owner/admin only):**
```
[── handle bar ──]
Record Payment for [Name]

Amount input
"Who paid?"  [member picker — real members only]
Optional note input

[Record Payment]
```

---

## 7. Notifications Screen

**Route:** `/(app)/notifications`
**Header:** "Notifications"

**Purpose:** Cross-group personal inbox. Distinct from the Activity Tab inside each group.

**What appears here:**
- `mention` — someone @mentioned you
- `item_reassigned` — an item assigned to you was reassigned
- `group_invite` — you were invited to a new group
- `expense_added` / `expense_edited` / `expense_deleted` — financial activity in your groups
- `payment_recorded` — a payment was recorded
- `standing_order_fired` — a recurring expense ran
- `standing_order_failed` — a recurring expense failed (admin/owner only)
- `placeholder_claim_available` — matches found on signup

**Each row:**
```
[Icon]  [Body text — always generic]
        [Group name · time ago]
[Unread dot — right]
```

**Tap destinations:**
- `expense_added` / `expense_edited` / `expense_deleted` → group chat, scrolled to expense card
- `payment_recorded` → group chat Activity tab
- `mention` → group chat, scrolled to message
- `item_reassigned` → group chat, opens Assign Items panel
- `group_invite` → group preview / join flow
- `standing_order_fired` → group chat, scrolled to the expense card
- `standing_order_failed` → group settings, scrolled to Recurring Expenses section
- `placeholder_claim_available` → claiming screen

**Empty state:**
```
No notifications yet.
You'll be notified about activity across all your groups here.
```

---

## 8. Placeholder Claiming Screen

**Route:** `/(app)/claim`
**Presentation:** Full-screen modal, shown automatically post-signup if matches found

> **Detailed screen design deferred** to a dedicated screen-design session.

**High-level layout:**
```
"We found balances that might be yours"
Caption: "Review each one and confirm to merge your history"

List of matched placeholders:
  Each row:
    - Group avatar + Group name
    - Placeholder name
    - Net balance (BalancePill)
    - [Confirm] / [Skip] actions

[Done] — enabled after reviewing all rows
```

---

## 9. Profile Screen

**Route:** `/(app)/profile`

```
Hero (brand gradient):
  [Avatar — large]
  [Display name]
  [Email]
  [Groups: N]  [Paid: $X.Xk]

Body:
  Account Settings
  Notification Preferences
  Privacy & Data
  Help & Support
  [Sign Out]
```

> **Onboarding walkthrough:** Deferred to post-v1.
> **Reliability / reputation score:** Deferred to post-v1. Not shown in v1.

---

## 10. Account Settings Screen

**Route:** `/(app)/profile/settings`

```
Section: Account
  - Email (read-only)
  - Auth provider (read-only)
  - [Change display name]
  - [Change avatar]

Section: Preferences
  - [Notification preferences] → sub-screen
  - Dark mode toggle

Section: Security
  - [Sign out from all devices]

Section: Danger Zone
  - [Delete account] → confirmation modal (30-day grace period)
```

---

## 11. Deep Link Routing Table

| Link pattern | Authenticated | Unauthenticated |
|---|---|---|
| `app://invite/{token}` | Confirmation sheet → groups list | Sign-in → post-auth join |
| `app://groups/{groupId}` | Navigate to group chat | Sign-in → post-auth navigate |
| `app://groups/{groupId}/expense/{expenseId}` | Group chat scrolled to expense | Sign-in → post-auth navigate |
| `app://groups/{groupId}/activity` | Group chat Activity tab | Sign-in → post-auth navigate |
| `app://groups/{groupId}/settings` | Group settings | Sign-in → post-auth navigate |
| `app://claim` | Claiming screen | Sign-in → post-auth claim |

---

## 12. Screen × Data × Real-time Summary

| Screen | TanStack Query hooks | Real-time channels |
|---|---|---|
| Groups list | `useGroups` | `balances:{each groupId}` |
| Group chat — Chat tab | `useMessages`, `useMembers`, `useGroupBalances` | `messages:{groupId}`, `balances:{groupId}` |
| Group chat — Activity tab | `useExpenses`, `usePayments` | `balances:{groupId}` |
| Group chat — Settle tab/sheet | `useGroupBalances` | `balances:{groupId}` |
| Assign Items panel | `useExpense`, `useMembers` | None (optimistic update) |
| Expense creation | `useMembers(groupId)`, `useExpenseDraft(groupId)` | None |
| Expense edit | `useExpense(expenseId)`, `useMembers(groupId)` | None |
| Standing order creation | `useMembers(groupId)` | None |
| Notifications | `useNotifications` | `notifications:{userId}` |
| Profile | `getCurrentUser`, `useGroups` | None |
| Group settings | `useGroup`, `useMembers`, `usePlaceholders`, `useInvites`, `useStandingOrders` | None |
| Claiming screen | `usePlaceholderMatches` | None |
