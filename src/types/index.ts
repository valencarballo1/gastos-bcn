export type ViewKey =
  | "dashboard"
  | "expenses"
  | "recurring"
  | "balances"
  | "shopping"
  | "tasks"
  | "calendar"
  | "activity"
  | "reports"
  | "members"
  | "settings";

export type SplitType = "equal" | "fixed" | "responsible";
export type ExpenseStatus = "pending" | "paid" | "cancelled";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Household {
  id: string;
  name: string;
  currency: "EUR";
  timezone: string;
  createdByUserId?: string;
  rowVersion?: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId?: string;
  name: string;
  initials: string;
  email?: string;
  color: string;
  role: "owner" | "admin" | "member";
  active: boolean;
  joinedAt: string;
  rowVersion?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  color: string;
  provider: string;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  memberCount: number;
}

export interface HouseholdInvitation {
  id: string;
  householdId: string;
  email?: string;
  role: "admin" | "member";
  mode: "email" | "link";
  token: string;
  inviteUrl?: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  type: "expense" | "task" | "shopping";
  rowVersion?: string;
}

export interface ExpenseParticipant {
  memberId: string;
  amount: number;
  percentage?: number;
}

export interface Expense {
  id: string;
  householdId: string;
  description: string;
  categoryId: string;
  amount: number;
  currency: "EUR";
  paidByMemberId: string;
  date: string;
  splitType: SplitType;
  participants: ExpenseParticipant[];
  status: ExpenseStatus;
  recurringExpenseId?: string;
  notes?: string;
  createdAt: string;
  rowVersion?: string;
}

export interface RecurringExpense {
  id: string;
  householdId: string;
  name: string;
  categoryId: string;
  estimatedAmount: number | null;
  variableAmount: boolean;
  frequency: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
  frequencyInterval?: number;
  dueDay: number;
  paidByMemberId: string;
  participantIds: string[];
  splitType: SplitType;
  status: "active" | "paused";
  nextDueDate: string;
  startDate?: string;
  endDate?: string;
  reminderDays: number;
  rowVersion?: string;
}

export interface Settlement {
  id: string;
  householdId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
  method: "Bizum" | "Transferencia" | "Efectivo" | "PayPal" | "Revolut" | "Otro";
  concept: string;
  notes?: string;
  status: "active" | "reversed";
  rowVersion?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  order?: number;
  rowVersion?: string;
}

export interface HouseholdTask {
  id: string;
  householdId: string;
  title: string;
  description?: string;
  category: string;
  categoryId?: string;
  assignedToMemberId?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  recurrence?: string;
  evidenceUrl?: string;
  checklist: ChecklistItem[];
  createdAt: string;
  completedAt?: string;
  rowVersion?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  categoryId?: string;
  addedByMemberId: string;
  priority: "normal" | "high";
  purchased: boolean;
  supermarket?: string;
  notes?: string;
  estimatedPrice?: number;
  actualPrice?: number;
  expenseId?: string;
  createdAt: string;
  rowVersion?: string;
}

export interface ShoppingList {
  id: string;
  householdId: string;
  name: string;
  weekOf: string;
  weekStart?: string;
  status: "open" | "closed";
  items: ShoppingItem[];
  rowVersion?: string;
}

export interface Activity {
  id: string;
  householdId: string;
  memberId?: string;
  entityType: "expense" | "settlement" | "task" | "shopping" | "recurring" | "member";
  action: string;
  description: string;
  date: string;
}

export interface HouseholdData {
  household: Household;
  members: HouseholdMember[];
  categories: Category[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  settlements: Settlement[];
  tasks: HouseholdTask[];
  shoppingLists: ShoppingList[];
  activities: Activity[];
}

export interface BalanceSummary {
  memberId: string;
  paid: number;
  owed: number;
  settlementsSent: number;
  settlementsReceived: number;
  balance: number;
}

export interface SuggestedTransfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}
