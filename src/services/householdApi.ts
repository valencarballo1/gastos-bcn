import type {
  Category,
  Expense,
  Household,
  HouseholdInvitation,
  HouseholdMember,
  HouseholdSummary,
  HouseholdTask,
  RecurringExpense,
  Settlement,
  ShoppingItem,
  ShoppingList,
  UserAccount,
} from "@/types";
import { API_URL, ApiError, apiPath, apiRequest } from "./api";

const TASK_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function numericId(value: string | number | undefined) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError({
      status: 400,
      code: "INVALID_ID",
      message: "El identificador seleccionado no es válido.",
    });
  }
  return parsed;
}

function taskPriority(value: HouseholdTask["priority"]) {
  if (!TASK_PRIORITIES.has(value)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_ENUM",
      message: "La prioridad seleccionada no es válida.",
      fieldErrors: {
        priority: ["Usá low, medium, high o urgent."],
      },
    });
  }
  return value;
}

function taskDueDate(value: string | undefined) {
  if (!value) return null;
  if (!value.includes("T") || Number.isNaN(Date.parse(value))) {
    throw new ApiError({
      status: 400,
      code: "INVALID_DATE",
      message: "La fecha límite no es válida.",
      fieldErrors: {
        dueDate: ["Usá una fecha ISO 8601 completa."],
      },
    });
  }
  return value;
}

function expenseRequest(
  payload: Omit<Expense, "id" | "householdId" | "createdAt">,
) {
  return {
    description: payload.description,
    categoryId: numericId(payload.categoryId),
    amount: payload.amount,
    currency: payload.currency,
    paidByMemberId: numericId(payload.paidByMemberId),
    date: payload.date,
    splitType: payload.splitType,
    status: payload.status,
    participants: payload.participants.map((participant) => ({
      memberId: numericId(participant.memberId),
      amount: participant.amount,
      percentage: participant.percentage,
    })),
    notes: payload.notes,
    rowVersion: payload.rowVersion,
  };
}

function taskRequest(payload: Omit<HouseholdTask, "id" | "householdId" | "createdAt">) {
  return {
    title: payload.title,
    description: payload.description,
    categoryId: numericId(payload.categoryId),
    assignedToMemberId: numericId(payload.assignedToMemberId),
    priority: taskPriority(payload.priority),
    dueDate: taskDueDate(payload.dueDate),
    checklist: payload.checklist.map((item, index) => ({
      text: item.text,
      order: item.order ?? index + 1,
    })),
    evidenceUrl: payload.evidenceUrl,
    rowVersion: payload.rowVersion,
  };
}

function recurringExpenseRequest(
  payload: Omit<RecurringExpense, "id" | "householdId">,
) {
  return {
    name: payload.name,
    categoryId: numericId(payload.categoryId),
    estimatedAmount: payload.estimatedAmount,
    variableAmount: payload.variableAmount,
    frequency: payload.frequency,
    frequencyInterval: payload.frequencyInterval ?? 1,
    dueDay: payload.dueDay,
    paidByMemberId: numericId(payload.paidByMemberId),
    splitType: payload.splitType,
    startDate:
      payload.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: payload.endDate,
    reminderDays: payload.reminderDays,
    participants: payload.participantIds.map((memberId) => ({
      memberId: numericId(memberId),
    })),
    rowVersion: payload.rowVersion,
  };
}

function shoppingItemRequest(
  payload: Omit<ShoppingItem, "id" | "createdAt" | "purchased" | "rowVersion">,
) {
  return {
    name: payload.name,
    quantity: payload.quantity,
    unit: payload.unit,
    categoryId: numericId(payload.categoryId),
    addedByMemberId: numericId(payload.addedByMemberId),
    priority: payload.priority,
    supermarket: payload.supermarket,
    estimatedPrice: payload.estimatedPrice,
    notes: payload.notes,
  };
}

export type ListFilters = Record<
  string,
  string | number | boolean | undefined
>;

export type BalanceResponse = {
  members: Array<{
    memberId: string;
    paid: number;
    owed: number;
    settlementsSent: number;
    settlementsReceived: number;
    balance: number;
  }>;
  suggestedTransfers: Array<{
    fromMemberId: string;
    toMemberId: string;
    amount: number;
  }>;
};

export type PublicInvitation = {
  householdName: string;
  invitedByName: string;
  email?: string;
  expiresAt: string;
  requiresLogin: boolean;
};

export type HouseholdUpdate = Pick<
  Household,
  "name" | "currency" | "timezone"
> & {
  rowVersion?: string;
};

export const householdApi = {
  auth: {
    // Never reuse the anonymous response fetched before an OAuth round trip.
    me: () =>
      apiRequest<UserAccount>("/auth/me", { cache: "no-store" }, true, false),
    googleLoginUrl: (returnUrl: string) =>
      `${API_URL}/api/auth/google/login?returnUrl=${encodeURIComponent(returnUrl)}`,
    logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),
  },

  households: {
    list: () => apiRequest<HouseholdSummary[]>("/hogares"),
    create: (payload: {
      name: string;
      currency: "EUR";
      timezone: string;
    }) =>
      apiRequest<Household>("/hogares", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    get: (householdId: string) =>
      apiRequest<Household>(`/hogares/${householdId}`),
    update: (householdId: string, payload: HouseholdUpdate) =>
      apiRequest<Household>(`/hogares/${householdId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
  },

  dashboard: (householdId: string) =>
    apiRequest<unknown>(`/hogares/${householdId}/dashboard`),

  members: {
    list: (householdId: string) =>
      apiRequest<HouseholdMember[]>(
        `/hogares/${householdId}/integrantes`,
      ),
    get: (householdId: string, memberId: string) =>
      apiRequest<HouseholdMember>(
        `/hogares/${householdId}/integrantes/${memberId}`,
      ),
    create: (
      householdId: string,
      payload: Pick<
        HouseholdMember,
        "name" | "email" | "initials" | "color"
      >,
    ) =>
      apiRequest<HouseholdMember>(
        `/hogares/${householdId}/integrantes`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    update: (
      householdId: string,
      memberId: string,
      payload: Partial<HouseholdMember> & { rowVersion?: string },
    ) =>
      apiRequest<HouseholdMember>(
        `/hogares/${householdId}/integrantes/${memberId}`,
        { method: "PUT", body: JSON.stringify(payload) },
      ),
    setStatus: (
      householdId: string,
      memberId: string,
      active: boolean,
      rowVersion?: string,
    ) =>
      apiRequest<HouseholdMember | void>(
        `/hogares/${householdId}/integrantes/${memberId}/estado`,
        {
          method: "PATCH",
          body: JSON.stringify({ active, rowVersion }),
        },
      ),
  },

  invitations: {
    list: (householdId: string) =>
      apiRequest<HouseholdInvitation[]>(
        `/hogares/${householdId}/invitaciones`,
      ),
    getPublic: (token: string) =>
      apiRequest<PublicInvitation>(
        `/invitaciones/${encodeURIComponent(token)}`,
      ),
    create: (
      householdId: string,
      payload: {
        email?: string;
        mode: HouseholdInvitation["mode"];
        role: HouseholdInvitation["role"];
      },
    ) =>
      apiRequest<HouseholdInvitation>(
        `/hogares/${householdId}/invitaciones`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    revoke: (householdId: string, invitationId: string) =>
      apiRequest<void>(
        `/hogares/${householdId}/invitaciones/${invitationId}`,
        { method: "DELETE" },
      ),
    accept: (token: string) =>
      apiRequest<Household | HouseholdMember>(
        `/invitaciones/${encodeURIComponent(token)}/aceptar`,
        { method: "POST" },
      ),
  },

  categories: {
    list: (householdId: string, type?: Category["type"]) =>
      apiRequest<Category[]>(
        apiPath(`/hogares/${householdId}/categorias`, { tipo: type }),
      ),
    create: (
      householdId: string,
      payload: Omit<Category, "id">,
    ) =>
      apiRequest<Category>(`/hogares/${householdId}/categorias`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (
      householdId: string,
      categoryId: string,
      payload: Partial<Category> & { rowVersion?: string },
    ) =>
      apiRequest<Category>(
        `/hogares/${householdId}/categorias/${categoryId}`,
        { method: "PUT", body: JSON.stringify(payload) },
      ),
    remove: (householdId: string, categoryId: string) =>
      apiRequest<void>(
        `/hogares/${householdId}/categorias/${categoryId}`,
        { method: "DELETE" },
      ),
  },

  expenses: {
    list: (householdId: string, filters: ListFilters = {}) =>
      apiRequest<Expense[]>(
        apiPath(`/hogares/${householdId}/gastos`, filters),
      ),
    get: (householdId: string, expenseId: string) =>
      apiRequest<Expense>(
        `/hogares/${householdId}/gastos/${expenseId}`,
      ),
    create: (
      householdId: string,
      payload: Omit<
        Expense,
        "id" | "householdId" | "createdAt" | "rowVersion"
      >,
    ) =>
      apiRequest<Expense>(`/hogares/${householdId}/gastos`, {
        method: "POST",
        body: JSON.stringify(expenseRequest(payload)),
      }),
    update: (
      householdId: string,
      expenseId: string,
      payload: Omit<Expense, "id" | "householdId" | "createdAt">,
    ) =>
      apiRequest<Expense>(
        `/hogares/${householdId}/gastos/${expenseId}`,
        { method: "PUT", body: JSON.stringify(expenseRequest(payload)) },
      ),
    cancel: (
      householdId: string,
      expenseId: string,
      rowVersion?: string,
    ) =>
      apiRequest<void>(
        `/hogares/${householdId}/gastos/${expenseId}`,
        {
          method: "DELETE",
          body: JSON.stringify({ rowVersion }),
        },
      ),
    createBatch: (
      householdId: string,
      payload: Array<Record<string, unknown>>,
    ) =>
      apiRequest<Expense[]>(`/hogares/${householdId}/gastos/lote`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  balances: {
    get: (householdId: string, filters: ListFilters = {}) =>
      apiRequest<BalanceResponse>(
        apiPath(`/hogares/${householdId}/balances`, filters),
      ),
  },

  settlements: {
    list: (householdId: string, filters: ListFilters = {}) =>
      apiRequest<Settlement[]>(
        apiPath(`/hogares/${householdId}/liquidaciones`, filters),
      ),
    create: (
      householdId: string,
      payload: Omit<
        Settlement,
        "id" | "householdId" | "status" | "rowVersion"
      >,
    ) =>
      apiRequest<Settlement>(
        `/hogares/${householdId}/liquidaciones`,
        {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            fromMemberId: numericId(payload.fromMemberId),
            toMemberId: numericId(payload.toMemberId),
          }),
        },
      ),
    reverse: (
      householdId: string,
      settlementId: string,
      reason: string,
      rowVersion?: string,
    ) =>
      apiRequest<Settlement>(
        `/hogares/${householdId}/liquidaciones/${settlementId}/revertir`,
        {
          method: "POST",
          body: JSON.stringify({ reason, rowVersion }),
        },
      ),
  },

  recurring: {
    list: (householdId: string) =>
      apiRequest<RecurringExpense[]>(
        `/hogares/${householdId}/gastos-recurrentes`,
      ),
    get: (householdId: string, recurringId: string) =>
      apiRequest<RecurringExpense>(
        `/hogares/${householdId}/gastos-recurrentes/${recurringId}`,
      ),
    create: (
      householdId: string,
      payload: Omit<
        RecurringExpense,
        "id" | "householdId" | "rowVersion"
      >,
    ) =>
      apiRequest<RecurringExpense>(
        `/hogares/${householdId}/gastos-recurrentes`,
        {
          method: "POST",
          body: JSON.stringify(recurringExpenseRequest(payload)),
        },
      ),
    update: (
      householdId: string,
      recurringId: string,
      payload: Omit<RecurringExpense, "id" | "householdId">,
    ) =>
      apiRequest<RecurringExpense>(
        `/hogares/${householdId}/gastos-recurrentes/${recurringId}`,
        {
          method: "PUT",
          body: JSON.stringify(recurringExpenseRequest(payload)),
        },
      ),
    setStatus: (
      householdId: string,
      recurringId: string,
      status: RecurringExpense["status"],
      rowVersion?: string,
    ) =>
      apiRequest<RecurringExpense | void>(
        `/hogares/${householdId}/gastos-recurrentes/${recurringId}/estado`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, rowVersion }),
        },
      ),
    occurrences: (
      householdId: string,
      filters: ListFilters = {},
    ) =>
      apiRequest<unknown[]>(
        apiPath(
          `/hogares/${householdId}/gastos-recurrentes/ocurrencias`,
          filters,
        ),
      ),
    registerOccurrencePayment: (
      householdId: string,
      occurrenceId: string,
      payload: Record<string, unknown>,
    ) =>
      apiRequest<Expense>(
        `/hogares/${householdId}/gastos-recurrentes/ocurrencias/${occurrenceId}/registrar-pago`,
        {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            paidByMemberId: numericId(
              payload.paidByMemberId as string | number | undefined,
            ),
            participants: Array.isArray(payload.participants)
              ? payload.participants.map((participant) => {
                  const entry = participant as Record<string, unknown>;
                  return {
                    ...entry,
                    memberId: numericId(
                      entry.memberId as string | number | undefined,
                    ),
                  };
                })
              : payload.participants,
          }),
        },
      ),
    cancelOccurrence: (
      householdId: string,
      occurrenceId: string,
      reason: string,
    ) =>
      apiRequest<void>(
        `/hogares/${householdId}/gastos-recurrentes/ocurrencias/${occurrenceId}/cancelar`,
        { method: "POST", body: JSON.stringify({ reason }) },
      ),
  },

  tasks: {
    list: (householdId: string, filters: ListFilters = {}) =>
      apiRequest<HouseholdTask[]>(
        apiPath(`/hogares/${householdId}/tareas`, filters),
      ),
    get: (householdId: string, taskId: string) =>
      apiRequest<HouseholdTask>(
        `/hogares/${householdId}/tareas/${taskId}`,
      ),
    create: (
      householdId: string,
      payload: Omit<
        HouseholdTask,
        "id" | "householdId" | "createdAt" | "rowVersion"
      >,
    ) =>
      apiRequest<HouseholdTask>(`/hogares/${householdId}/tareas`, {
        method: "POST",
        body: JSON.stringify(taskRequest(payload)),
      }),
    update: (
      householdId: string,
      taskId: string,
      payload: Omit<
        HouseholdTask,
        "id" | "householdId" | "createdAt"
      >,
    ) =>
      apiRequest<HouseholdTask>(
        `/hogares/${householdId}/tareas/${taskId}`,
        { method: "PUT", body: JSON.stringify(taskRequest(payload)) },
      ),
    setStatus: (
      householdId: string,
      taskId: string,
      status: HouseholdTask["status"],
      rowVersion?: string,
    ) =>
      apiRequest<HouseholdTask>(
        `/hogares/${householdId}/tareas/${taskId}/estado`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            completedAt:
              status === "completed" ? new Date().toISOString() : undefined,
            rowVersion,
          }),
        },
      ),
    remove: (
      householdId: string,
      taskId: string,
      rowVersion?: string,
    ) =>
      apiRequest<void>(`/hogares/${householdId}/tareas/${taskId}`, {
        method: "DELETE",
        body: JSON.stringify({ rowVersion }),
      }),
    addChecklist: (
      householdId: string,
      taskId: string,
      payload: { text: string; order: number; rowVersion?: string },
    ) =>
      apiRequest<HouseholdTask>(
        `/hogares/${householdId}/tareas/${taskId}/checklist`,
        {
          method: "POST",
          body: JSON.stringify({ text: payload.text, order: payload.order }),
        },
      ),
    updateChecklist: (
      householdId: string,
      taskId: string,
      itemId: string,
      payload: Record<string, unknown>,
    ) =>
      apiRequest<HouseholdTask>(
        `/hogares/${householdId}/tareas/${taskId}/checklist/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            text: payload.text,
            order: payload.order,
            completed: payload.completed,
          }),
        },
      ),
    removeChecklist: (
      householdId: string,
      taskId: string,
      itemId: string,
    ) =>
      apiRequest<void>(
        `/hogares/${householdId}/tareas/${taskId}/checklist/${itemId}`,
        { method: "DELETE" },
      ),
    comments: (householdId: string, taskId: string) =>
      apiRequest<unknown[]>(
        `/hogares/${householdId}/tareas/${taskId}/comentarios`,
      ),
    addComment: (
      householdId: string,
      taskId: string,
      text: string,
    ) =>
      apiRequest<unknown>(
        `/hogares/${householdId}/tareas/${taskId}/comentarios`,
        { method: "POST", body: JSON.stringify({ comment: text }) },
      ),
  },

  shopping: {
    lists: (householdId: string) =>
      apiRequest<ShoppingList[]>(
        `/hogares/${householdId}/listas-compra`,
      ),
    createList: (householdId: string, payload: { name: string }) =>
      apiRequest<ShoppingList>(
        `/hogares/${householdId}/listas-compra`,
        {
          method: "POST",
          body: JSON.stringify({
            name: payload.name,
            weekStart: new Date().toISOString().slice(0, 10),
          }),
        },
      ),
    getList: (householdId: string, listId: string) =>
      apiRequest<ShoppingList>(
        `/hogares/${householdId}/listas-compra/${listId}`,
      ),
    duplicateList: (householdId: string, listId: string) =>
      apiRequest<ShoppingList>(
        `/hogares/${householdId}/listas-compra/${listId}/duplicar`,
        { method: "POST" },
      ),
    addItem: (
      householdId: string,
      listId: string,
      payload: Omit<
        ShoppingItem,
        "id" | "createdAt" | "purchased" | "rowVersion"
      >,
    ) =>
      apiRequest<ShoppingItem>(
        `/hogares/${householdId}/listas-compra/${listId}/items`,
        { method: "POST", body: JSON.stringify(shoppingItemRequest(payload)) },
      ),
    updateItem: (
      householdId: string,
      listId: string,
      itemId: string,
      payload: Partial<ShoppingItem> & { rowVersion?: string },
    ) =>
      apiRequest<ShoppingItem>(
        `/hogares/${householdId}/listas-compra/${listId}/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: payload.name,
            quantity: payload.quantity,
            unit: payload.unit,
            categoryId: numericId(payload.categoryId),
            priority: payload.priority,
            purchased: payload.purchased,
            supermarket: payload.supermarket,
            estimatedPrice: payload.estimatedPrice,
            actualPrice: payload.actualPrice,
            notes: payload.notes,
            rowVersion: payload.rowVersion,
          }),
        },
      ),
    removeItem: (
      householdId: string,
      listId: string,
      itemId: string,
      rowVersion?: string,
    ) =>
      apiRequest<void>(
        `/hogares/${householdId}/listas-compra/${listId}/items/${itemId}`,
        {
          method: "DELETE",
          body: JSON.stringify({ rowVersion }),
        },
      ),
    clearPurchased: (householdId: string, listId: string) =>
      apiRequest<void>(
        `/hogares/${householdId}/listas-compra/${listId}/items-comprados`,
        { method: "DELETE" },
      ),
    finalize: (
      householdId: string,
      listId: string,
      payload: Record<string, unknown>,
    ) =>
      apiRequest<{
        shoppingListId: string;
        processedItemIds: string[];
        expense: Expense;
      }>(
        `/hogares/${householdId}/listas-compra/${listId}/finalizar-compra`,
        {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            itemIds: Array.isArray(payload.itemIds)
              ? payload.itemIds.map((id) =>
                  numericId(id as string | number),
                )
              : payload.itemIds,
            paidByMemberId: numericId(
              payload.paidByMemberId as string | number | undefined,
            ),
            participants: Array.isArray(payload.participants)
              ? payload.participants.map((participant) => {
                  const entry = participant as Record<string, unknown>;
                  return {
                    ...entry,
                    memberId: numericId(
                      entry.memberId as string | number | undefined,
                    ),
                  };
                })
              : payload.participants,
          }),
        },
      ),
    frequentProducts: (householdId: string) =>
      apiRequest<unknown[]>(
        `/hogares/${householdId}/productos/frecuentes`,
      ),
    favoriteProducts: (householdId: string) =>
      apiRequest<unknown[]>(
        `/hogares/${householdId}/productos-favoritos`,
      ),
    createFavorite: (
      householdId: string,
      payload: Record<string, unknown>,
    ) =>
      apiRequest<unknown>(
        `/hogares/${householdId}/productos-favoritos`,
        {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            categoryId: numericId(
              payload.categoryId as string | number | undefined,
            ),
          }),
        },
      ),
  },

  calendar: (householdId: string, filters: ListFilters = {}) =>
    apiRequest<unknown>(
      apiPath(`/hogares/${householdId}/calendario`, filters),
    ),
  activity: (householdId: string, filters: ListFilters = {}) =>
    apiRequest<unknown>(
      apiPath(`/hogares/${householdId}/actividad`, filters),
    ),
  reports: {
    expenses: (householdId: string, filters: ListFilters = {}) =>
      apiRequest<unknown>(
        apiPath(`/hogares/${householdId}/reportes/gastos`, filters),
      ),
    tasks: (householdId: string, filters: ListFilters = {}) =>
      apiRequest<unknown>(
        apiPath(`/hogares/${householdId}/reportes/tareas`, filters),
      ),
  },
};
