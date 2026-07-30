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
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  name: string;
  initials: string;
  email?: string;
  color: string;
  active: boolean;
  joinedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  type: "expense" | "task" | "shopping";
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
}

export interface RecurringExpense {
  id: string;
  householdId: string;
  name: string;
  categoryId: string;
  estimatedAmount: number | null;
  variableAmount: boolean;
  frequency: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
  dueDay: number;
  paidByMemberId: string;
  participantIds: string[];
  splitType: SplitType;
  status: "active" | "paused";
  nextDueDate: string;
  reminderDays: number;
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
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface HouseholdTask {
  id: string;
  householdId: string;
  title: string;
  description?: string;
  category: string;
  assignedToMemberId?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  recurrence?: string;
  checklist: ChecklistItem[];
  createdAt: string;
  completedAt?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  addedByMemberId: string;
  priority: "normal" | "high";
  purchased: boolean;
  supermarket?: string;
  estimatedPrice?: number;
  actualPrice?: number;
  expenseId?: string;
  createdAt: string;
}

export interface ShoppingList {
  id: string;
  householdId: string;
  name: string;
  weekOf: string;
  status: "open" | "closed";
  items: ShoppingItem[];
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
