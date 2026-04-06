# Product Requirements Document (PRD)
**Project:** Halvy — Next-Gen Social Expense Splitting Ecosystem
**Version:** 6.0
**Status:** Draft

> **v4.0 changes:** Removed reliability score / gamification system from v1 scope. Section H replaced with deferred note. Section 4.2 updated. Section 8 updated.

> **v5.0 changes:** Section 4.3 expanded with full placeholder UX design. Section 5.A updated to distinguish Activity Tab from Notifications Tab. Onboarding deferred to Section 8.

> **v6.0 changes:** Section G (Splitting Logic & Automation) expanded with full Standing Orders design — custom recurrence, split mode choice, failure handling, permissions, entry point, and chat appearance.

---

## 1. Problem Statement

Existing expense-splitting tools (Splitwise, Tricount, etc.) suffer from three core failures:

- **Manual friction:** Entry requires deliberate app-switching, killing the momentum of real-life shared moments.
- **Math inaccuracy:** Equal splits ignore proportional tax and tip, leading to small but persistent resentment.
- **No social layer:** The core loop — someone pays, others owe, someone nags, someone settles — happens entirely outside the app, in chat threads and awkward conversations.

The result is that most groups abandon tracking after a few entries, leaving debts unresolved and relationships mildly strained. Halvy closes that loop by making the social layer the product.

---

## 2. Product Vision & Value Proposition

A social-first, AI-powered mobile and web application that eliminates the friction, math, and awkwardness of shared expenses. By replacing the traditional static ledger with a real-time, messaging-based interface and a living balance model, Halvy transforms expense management into a seamless, collaborative social experience.

**Core promise:** From shared expense to settled debt — without leaving the conversation.

---

## 3. Target Audience & Use Cases

| Group Type | Primary Pain Point | Key Feature Dependency |
|---|---|---|
| **Dining Groups** | Accurate itemized splits with proportional tax & tip | AI OCR + collaborative item assignment |
| **Travel Companions** | Multi-day, multi-person, complex debt webs | Living balance model + debt graph simplification |
| **Households / Roommates** | Recurring bills, long-term fairness | Standing Orders + always-live balances |

---

## 4. Account Model & Access Policy

### 4.1 Mandatory Account Creation

All users must hold a registered account to participate in any group. There are no guest or view-only access modes.

**Rationale:** Every participant is a financial actor. Unregistered users cannot be reliably attributed in a balance graph.

### 4.2 Account as a Meaningful Advantage

The account is not merely a login gate — it is the vehicle for core value. Registered users unlock:

- **Persistent identity across groups:** Balance history and avatar follow you across all groups.
- **AI-powered expense entry:** OCR, voice dictation, and smart item assignment are account-gated features.
- **Balance history & audit trail:** Full record of every expense and payment across all groups, permanently accessible.

### 4.3 Handling Non-App Users (Placeholder Members)

Groups frequently include people who do not use Halvy. Placeholders allow full financial participation without requiring the other person to sign up.

#### Creating a Placeholder

Placeholders can be created in three places:
- **During group creation** — add non-app members upfront alongside real members
- **From group settings** — add a placeholder at any time after the group is created
- **Inline during item assignment** — when assigning an item, any member can create a new placeholder on the spot

**Fields captured:**
- Display name (required)
- Phone number or email address (optional — used for automatic matching when they later sign up)

Any group member can create a placeholder.

#### Visual Identity

Placeholders appear everywhere real members do — balance strip, member list, item assignment panel, settle tab — but are visually distinct: a grayed-out avatar showing their initials. The gray treatment is the consistent signal across the app.

#### Permissions

| Action | Who can do it |
|---|---|
| Create a placeholder | Any group member |
| Edit placeholder name or contact | Owner or admin only |
| Assign items to a placeholder | Any group member |
| Record a payment on behalf of a placeholder | Owner or admin only |

#### Invite Nudge

Only the group owner and admins see a persistent prompt in group settings: *"Invite [Name] to claim their balance."* Regular members are not nudged.

#### Claiming Flow (When They Join Halvy)

When a new user signs up, Halvy automatically checks their phone number or email against all unclaimed placeholders across all groups:

1. If matches are found, the user sees: *"We found balances that might be yours"* — a list of matched placeholders per group showing the group name and net balance.
2. The user reviews each match and confirms or skips independently. Partial claiming is supported.
3. On confirmation per group: full balance and expense history transfers to their real account. The placeholder row is retired.
4. If no contact info was stored, no auto-match occurs. The owner/admin can manually send an invite link.

> **Claiming screen design** is deferred to a dedicated screen-design session.

#### Unclaimed Placeholders

If a group winds down and a placeholder was never claimed, the owner or admin decides — record a manual payment to zero the balance, or leave it as-is. No automatic cleanup occurs.

### 4.4 Cold Start & Group Adoption Strategy

#### 4.4.1 The Single-Adopter Problem

- **Invite link preview (no auth required):** Non-users see group name, avatar, member count, and inviter's name before being asked to sign up.
- **Payer-centric solo value:** Even with no other members, the payer can use the app as a personal expense log with receipt OCR.
- **Placeholder UX as a bridge:** Placeholders are first-class participants — grayed avatar with initials, normal split assignments, owner/admin invite nudge in group settings.

#### 4.4.2 Reducing Sign-Up Friction for Invitees

- **One-tap join after sign-up:** Invitee lands directly in the group chat with their balance already visible.
- **Immediate context on arrival:** Expenses already logged show with their share assigned.
- **Auto-match on join:** If phone or email matches a placeholder, the user is prompted to confirm the claim immediately after signing up.

#### 4.4.3 Viral Mechanics (Organic, Not Forced)

- **Payment nudge:** When an admin records a payment on behalf of a placeholder, a prompt suggests inviting them to claim their balance.
- **Expense Card as proof:** Shared externally, the card renders as a clean branded summary.
- **No forced virality:** All features work with placeholders. Inviting is always optional.

#### 4.4.4 Metrics for Adoption Health

| Metric | Target | Rationale |
|---|---|---|
| Invite-to-signup rate | > 40% | Measures invite link → completed registration |
| Time from invite to first group view | < 60 seconds | Measures onboarding friction |
| Placeholder claim rate | > 60% | Measures history merge success |
| Groups with ≥ 3 active members at 7 days | > 50% | Measures group critical mass |

---

## 5. Core Capabilities & Feature Set

### A. Social-First Chat Interface

- **Messaging-Centric Navigation:** The primary UI is a real-time group chat thread. The app feels and navigates like a messaging application.
- **Interactive Expense Cards:** When an expense is added, it is injected into the chat stream as a visually distinct, tappable Expense Card — not a background update.
- **In-Thread Actions:** Users tap an Expense Card to assign items, edit the expense, or reply in thread. Emoji reactions acknowledge and respond to financial events.
- **@Mentions:** Any member can @mention another in chat. Mentioned members receive a push notification and are highlighted inline.
- **Activity Tab (group-scoped financial history):** A dedicated tab within each group chat shows the financial timeline for that group only — expenses added/edited/deleted, and payments recorded. Chat messages are excluded. This is a history view, not an alert inbox.
- **Notifications Tab (cross-group personal inbox):** A dedicated tab in the main navigation surfaces all alerts requiring the user's personal attention across all groups — @mentions, item reassignments, group invites, standing order events. Personal and global, not tied to any single group.
- **System Events:** Actions like "Ahmed added Dinner at Nobu" and "Sara paid Khalid · $85" appear as automated messages in the chat thread.

### B. Group Creation & Management

- **Frictionless Onboarding:** Groups are created like messaging groups — name, avatar, invite via deep link or QR code.
- **Group Type Paradigms:** Users select a group type (Trip, House, Dinner) which pre-configures default splitting behaviour and the item assignment timeout.
- **Configurable Assignment Timeout:** Each group has a configurable timeout after which unassigned expense items auto-lock to the payer's tab. Default: 2 hours for Dinner, 24 hours for Trip/House. Group admin can adjust in settings.
- **Member Balance Display:** Each member's live net balance is displayed next to their avatar at the top of the chat screen, updating in real time.

### C. AI-Powered Expense Addition

- **The Quick-Add Action:** A `+` button next to the chat input opens the entry method picker.
- **Receipt OCR (Visual):** Users photograph a receipt. AI extracts individual line items, confidence scores are surfaced when uncertain.
- **Voice Dictation (Audio):** Users dictate naturally: *"I paid $120 for groceries — put $30 on Khalid for his protein powder and split the rest equally."*
- **Manual Entry:** Traditional form with line items, payer picker, and split type selector.
- **Unified Output:** Regardless of entry method, the result is always the same Expense Card posted to chat with items initially unassigned.

### D. Collaborative Item Assignment

- **Items start unassigned:** When an expense is posted, all line items are unassigned. The payer's balance reflects the full amount until items are claimed.
- **Any member assigns, any time:** Any group member can open an Expense Card and assign items to themselves or others.
- **Split one item across multiple members:** A single line item can be assigned to multiple people with equal or custom amounts.
- **Reassignment notifications:** If a member's already-claimed item is reassigned by someone else, they receive a batched notification.
- **Assignment timeout:** After the group's configured timeout, unassigned items auto-lock to the payer.

### E. Living Balance Model

- **Every event is a balance entry:** Expenses, item assignments, edits, deletions, and payments all update member balances immediately and automatically.
- **No locked states:** Expenses are always editable by any group member. No lock step, no confirm settlement step, no dispute mechanism.
- **Payments are permanent facts:** A payment is a permanent ledger entry, affecting balances regardless of future expense edits.
- **Edit and delete cascade automatically:** Editing or deleting an expense immediately recalculates all affected balances.
- **Balances are always the truth:** A member's balance is the live net of all their expenses and payments in the group.

**Edit permissions:** Any group member can edit any expense at any time.
**Delete permissions:** Creator and group admin/owner only.

### F. Settlement Calculation (On-Demand Snapshots)

- **Anyone can trigger a settlement view:** Any group member can open the Settle view at any moment.
- **Debt graph simplification:** The algorithm minimises total transactions.
- **Settlements are never persisted:** The settlement view is a computed snapshot. It recalculates automatically as the ledger changes.
- **Recording a payment:** Tapping "Record Payment" creates a payment entry, posts a system message, and immediately recalculates balances.

### G. Splitting Logic & Automation

- **Split types:** Equal, percentage, fixed amount, income ratio, and item-based (default for OCR/voice).
- **Proportional tax & tip:** Tax and tip are distributed proportionally based on each member's assigned item subtotal — never split equally.
- **Payer exclusion:** The payer can be excluded from splits (company card, paying on behalf of).

#### Standing Orders (Recurring Expenses)

Standing Orders automate recurring group expenses — rent, subscriptions, utility bills — by automatically injecting a new Expense Card into the group chat on a user-defined schedule.

**Creation:**
- Created from the `+` button in chat, alongside Manual / OCR / Voice entry methods
- Any group member can create a Standing Order
- User sets the first run date explicitly at creation — the order does not fire immediately

**Recurrence:**
- Fully custom interval: user specifies a number and a unit (e.g. every 1 week, every 2 weeks, every 1 month, every 3 months)
- No fixed presets — the interval is free-form within day / week / month / year units

**Split Mode (chosen at creation, editable later):**
- **Fixed split** — the split rule is defined once at creation and applies automatically every time the order fires. The expense card is posted with splits pre-applied. No collaborative assignment needed.
- **Collaborative** — each firing posts an Expense Card with items unassigned, exactly like a manual expense. Members assign items in chat as usual.

**How it appears in chat:**
- Each firing injects a standard Expense Card into the chat thread
- The card is visually tagged with a 🔁 recurring icon to distinguish it from one-off expenses
- A system event message is also posted: *"[title] was added automatically"*
- Past firings appear in the Activity tab like any other expense — no dedicated history view

**Permissions:**
- Any group member can create, edit, or pause a Standing Order
- Only owner/admin can delete a Standing Order permanently

**Pausing and Stopping:**
- Any member can toggle a Standing Order on/off (pause/resume)
- Owner/admin can delete it permanently from group settings
- Pausing is reversible; deletion is not

**Failure Handling:**
- If a firing fails (system error), the order retries up to 3 times with exponential backoff
- After 3 consecutive failures: the order is automatically paused and a `standing_order_failed` notification is sent to all group admins and the owner
- The `last_error`, `last_error_at`, and `consecutive_failures` fields are stored on the record for debugging
- An error indicator is shown on the Standing Order row in group settings
- The owner/admin must manually review and re-activate the order after a failure pause

### H. Reliability Score & Reputation (Deferred)

User reputation and reliability scoring is deferred to a future version. The exact behaviours to credit and the scoring mechanism are still being defined and will be designed as a dedicated workstream post-v1.

---

## 6. Security & Privacy

### 6.1 Authentication

- Users authenticate via OAuth 2.0 (Google, Apple) or magic link email — no passwords stored.
- Sessions are short-lived with refresh token rotation.

### 6.2 Data Access & Row-Level Security

- All financial records are protected by row-level security at the database layer.
- Users can only read and write records belonging to groups they are confirmed members of.

### 6.3 Receipt Photo Handling

- Receipt images are stored encrypted in object storage.
- Images are retained for 90 days after upload, then permanently deleted.
- Images are never used for advertising, training, or shared outside the group.

### 6.4 Abuse Prevention

- **Expense visibility:** Any expense is immediately visible to all members. Any member can edit or reply to discuss.
- **No formal dispute mechanism:** Disagreements are resolved collaboratively by editing.
- **Delete restriction:** Only creators and admins can delete expenses.
- **Generic notifications:** All notifications use generic bodies — no specific financial amounts in push payloads.

---

## 7. Technical Architecture

### 7.1 Stack Overview

| Layer | Technology | Role |
|---|---|---|
| Cross-Platform Shell | Expo SDK 52 (React Native 0.76) | Single codebase targeting iOS, Android, and web. Fabric enabled by default. |
| UI & Styling | NativeWind v4 (Tailwind CSS) + Reanimated 3 | Consistent styling and native animations |
| Backend & Database | Supabase (PostgreSQL) | Relational financial data, RLS, real-time WebSocket subscriptions |
| AI & Parsing | Gemini API | Multimodal receipt OCR and voice dictation parsing |

### 7.2 Real-Time Architecture

The app is connection-dependent — offline usage is out of scope for v1.

**Real-time channels:**
- `messages:{groupId}` — chat messages and expense cards
- `balances:{groupId}` — live balance updates for all members

### 7.3 Known Constraints

- **Platform:** iOS, Android, and web via single Expo codebase.
- **Payments:** In-app payment processing deferred. v1 supports recording of real-world payments only.
- **Currency:** Multi-currency deferred. v1 operates in a single currency per group.

---

## 8. Out of Scope (v1)

- Offline / local-first data sync
- Guest or view-only access
- In-app payment processing
- Multi-currency and FX conversion
- Enterprise or business expense reporting
- Gamification and user reputation / reliability scoring
- **Onboarding walkthrough & first-run experience** — deferred to post-v1. Best designed once the full app exists so real screens can be used for feature highlights and contextual tips.

---

## 9. North Star Metric

**Time to Settle:** Total elapsed time from expense creation to all group balances reaching zero.

Secondary metrics:
- Expense entry completion rate (started vs. posted Expense Cards)
- Item assignment rate (% of line items assigned before timeout)
- Payment recording rate (settlement suggestions acted on within 48h)
- Group retention at 30 / 90 days
- Invite-to-signup conversion rate
- Groups reaching 3+ active members within 7 days
