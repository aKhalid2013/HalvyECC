// 7 Discriminated Union Types (Enums)

export type MemberRole = 'owner' | 'admin' | 'member';
export type GroupType = 'dinner' | 'trip' | 'house';
export type ExpenseEntryMethod = 'manual' | 'ocr' | 'voice' | 'standing_order';
export type MessageType = 'user_text' | 'expense_card' | 'system_event' | 'expense_reply';
export type NotificationType = 
  | 'expense_added' 
  | 'expense_edited' 
  | 'expense_deleted' 
  | 'payment_recorded' 
  | 'mention' 
  | 'item_reassigned' 
  | 'standing_order_fired' 
  | 'standing_order_failed' 
  | 'placeholder_claim_available' 
  | 'group_invite';
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';
export type StandingOrderSplitMode = 'fixed' | 'collaborative';

// 16 App-Level Interfaces (camelCase)

export interface User {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  avatarUrl: string | null;
  authProvider: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Group {
  id: string;
  name: string;
  avatarUrl: string | null;
  groupType: GroupType;
  currency: string;
  ownerId: string;
  assignmentTimeoutHours: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string | null;
  placeholderId: string | null;
  role: MemberRole;
  joinedAt: string;
  updatedAt: string;
}

export interface Placeholder {
  id: string;
  groupId: string;
  createdByUserId: string | null;
  displayName: string;
  phone: string | null;
  email: string | null;
  claimedByUserId: string | null;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  groupId: string;
  creatorUserId: string | null;
  payerUserId: string | null;
  payerPlaceholderId: string | null;
  title: string;
  totalAmount: number;
  currency: string;
  entryMethod: ExpenseEntryMethod;
  receiptImageUrl: string | null;
  messageId: string | null;
  standingOrderId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LineItem {
  id: string;
  expenseId: string;
  description: string;
  amount: number;
  isTax: boolean;
  isTip: boolean;
  ocrConfidence: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface LineItemSplit {
  id: string;
  lineItemId: string;
  expenseId: string;
  userId: string | null;
  placeholderId: string | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  groupId: string;
  fromUserId: string | null;
  fromPlaceholderId: string | null;
  toUserId: string | null;
  toPlaceholderId: string | null;
  amount: number;
  currency: string;
  note: string | null;
  messageId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Message {
  id: string;
  groupId: string;
  senderUserId: string | null;
  messageType: MessageType;
  body: string | null;
  expenseId: string | null;
  paymentId: string | null;
  parentMessageId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface Mention {
  id: string;
  messageId: string;
  groupId: string;
  mentionedUserId: string;
  mentionerUserId: string;
  createdAt: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface StandingOrder {
  id: string;
  groupId: string;
  createdByUserId: string | null;
  payerUserId: string | null;
  title: string;
  totalAmount: number;
  recurrenceEvery: number;
  recurrenceUnit: RecurrenceUnit;
  splitMode: StandingOrderSplitMode;
  splitRule: object | null;
  firstRunAt: string;
  nextRunAt: string;
  lastRunAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  groupId: string | null;
  expenseId: string | null;
  paymentId: string | null;
  messageId: string | null;
  standingOrderId: string | null;
  notificationType: NotificationType;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  inviterUserId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface RateLimit {
  id: string;
  userId: string;
  endpoint: string;
  requestsCount: number;
  windowStart: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiBudget {
  id: string;
  groupId: string;
  tokensUsedTotal: number;
  tokensUsedThisMonth: number;
  billingResetAt: string;
  createdAt: string;
  updatedAt: string;
}
