"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, errorMessage } from "@/services/api";
import {
  householdApi,
  type BalanceResponse,
  type HouseholdUpdate,
} from "@/services/householdApi";
import type {
  Activity,
  BalanceSummary,
  Category,
  Expense,
  Household,
  HouseholdData,
  HouseholdInvitation,
  HouseholdMember,
  HouseholdSummary,
  HouseholdTask,
  RecurringExpense,
  Settlement,
  ShoppingItem,
  ShoppingList,
  SuggestedTransfer,
} from "@/types";
import { invitationToken } from "@/utils/invitations";
import {
  openShoppingList,
  openShoppingListsFirst,
} from "@/utils/shopping";

const ACTIVE_HOUSEHOLD_KEY = "casaclara-active-household";

export const MUTATION_INVALIDATIONS = {
  expense: ["expenses", "balances", "dashboard", "reports", "activity"],
  settlement: [
    "balances",
    "settlements",
    "dashboard",
    "activity",
  ],
  recurring: [
    "recurring",
    "occurrences",
    "dashboard",
    "calendar",
    "activity",
  ],
  task: ["tasks", "dashboard", "calendar", "reports", "activity"],
  shopping: [
    "shopping",
    "expenses",
    "balances",
    "dashboard",
    "activity",
  ],
  member: ["members", "selectors", "dashboard"],
} as const;

const emptyShoppingList: ShoppingList = {
  id: "",
  householdId: "",
  name: "Lista de compra",
  weekOf: new Date().toISOString(),
  status: "open",
  items: [],
};

const emptyData: HouseholdData = {
  household: {
    id: "",
    name: "Casa Clara",
    currency: "EUR",
    timezone: "Europe/Madrid",
  },
  members: [],
  categories: [],
  expenses: [],
  recurringExpenses: [],
  settlements: [],
  tasks: [],
  shoppingLists: [emptyShoppingList],
  activities: [],
};

type RemoteState = "idle" | "loading" | "ready" | "error";

export function useHousehold(enabled: boolean, requestedHouseholdId?: string) {
  const [data, setData] = useState<HouseholdData>(emptyData);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [balances, setBalances] = useState<BalanceSummary[]>([]);
  const [suggestedTransfers, setSuggestedTransfers] = useState<
    SuggestedTransfer[]
  >([]);
  const [dashboard, setDashboard] = useState<unknown>(null);
  const [activeHouseholdId, setActiveHouseholdId] = useState("");
  const [status, setStatus] = useState<RemoteState>("idle");
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]>
  >({});
  const requestVersion = useRef(0);

  const captureError = useCallback((reason: unknown) => {
    setError(errorMessage(reason));
    setFieldErrors(
      reason instanceof ApiError ? reason.fieldErrors : {},
    );
  }, []);

  const loadHouseholds = useCallback(async () => {
    const response = await householdApi.households.list();
    const list = asArray<HouseholdSummary>(response).map(
      normalizeHouseholdSummary,
    );
    setHouseholds(list);
    return list;
  }, []);

  const loadHousehold = useCallback(
    async (householdId: string) => {
      if (!householdId) return;
      const version = ++requestVersion.current;
      setStatus("loading");
      setError(null);
      setFieldErrors({});

      const reads = await Promise.allSettled([
        householdApi.households.get(householdId),
        householdApi.dashboard(householdId),
        householdApi.members.list(householdId),
        householdApi.categories.list(householdId),
        householdApi.expenses.list(householdId, {
          pagina: 1,
          tamanio: 200,
        }),
        householdApi.recurring.list(householdId),
        householdApi.settlements.list(householdId, {
          pagina: 1,
          tamanio: 200,
        }),
        householdApi.tasks.list(householdId, {
          pagina: 1,
          tamanio: 200,
        }),
        householdApi.shopping.lists(householdId),
        householdApi.activity(householdId, {
          pagina: 1,
          tamanio: 100,
        }),
        householdApi.balances.get(householdId),
        householdApi.invitations.list(householdId),
      ]);

      if (version !== requestVersion.current) return;

      const householdResult = reads[0];
      if (householdResult.status === "rejected") {
        setStatus("error");
        captureError(householdResult.reason);
        return;
      }

      const household = normalizeHousehold(householdResult.value);
      const members = settledArray<HouseholdMember>(reads[2]).map(
        (member) => normalizeMember(member, household.id),
      );
      const categories = settledArray<Category>(reads[3]).map(
        normalizeCategory,
      );
      const expenses = settledArray<Expense>(reads[4]).map(
        (expense) => normalizeExpense(expense, household.id),
      );
      const recurringExpenses = settledArray<RecurringExpense>(
        reads[5],
      ).map((item) => normalizeRecurring(item, household.id));
      const settlements = settledArray<Settlement>(reads[6]).map(
        (item) => normalizeSettlement(item, household.id),
      );
      const tasks = settledArray<HouseholdTask>(reads[7]).map(
        (task) => normalizeTask(task, household.id),
      );
      const shoppingLists = settledArray<ShoppingList>(reads[8])
        .map((list) => normalizeShoppingList(list, household.id))
        .sort(openShoppingListsFirst);
      const activities = settledArray<Activity>(reads[9]).map(
        (activity) => normalizeActivity(activity, household.id),
      );
      const balanceResponse =
        reads[10].status === "fulfilled"
          ? normalizeBalanceResponse(reads[10].value)
          : { members: [], suggestedTransfers: [] };
      const inviteList = settledArray<HouseholdInvitation>(reads[11]).map(
        (invite) => normalizeInvitation(invite, household.id),
      );

      setData({
        household,
        members,
        categories,
        expenses,
        recurringExpenses,
        settlements,
        tasks,
        shoppingLists: shoppingLists.length
          ? shoppingLists
          : [{ ...emptyShoppingList, householdId: household.id }],
        activities,
      });
      setDashboard(
        reads[1].status === "fulfilled" ? reads[1].value : null,
      );
      setBalances(balanceResponse.members);
      setSuggestedTransfers(balanceResponse.suggestedTransfers);
      setInvitations(inviteList);
      setActiveHouseholdId(household.id);
      window.localStorage.setItem(ACTIVE_HOUSEHOLD_KEY, household.id);

      const partialFailure = reads
        .slice(1)
        .find((result) => result.status === "rejected");
      if (partialFailure?.status === "rejected") {
        setError(
          "Algunos bloques no pudieron actualizarse. Podés volver a cargarlos.",
        );
      }
      setStatus("ready");
    },
    [captureError],
  );

  const refresh = useCallback(async () => {
    const id = activeHouseholdId || data.household.id;
    if (id) await loadHousehold(id);
  }, [activeHouseholdId, data.household.id, loadHousehold]);

  useEffect(() => {
    if (!enabled) {
      requestVersion.current += 1;
      setData(emptyData);
      setHouseholds([]);
      setInvitations([]);
      setBalances([]);
      setSuggestedTransfers([]);
      setDashboard(null);
      setActiveHouseholdId("");
      setStatus("idle");
      setMutating(false);
      setError(null);
      setFieldErrors({});
      window.localStorage.removeItem(ACTIVE_HOUSEHOLD_KEY);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    void loadHouseholds()
      .then(async (list) => {
        if (cancelled) return;
        const preferred =
          requestedHouseholdId ??
          window.localStorage.getItem(ACTIVE_HOUSEHOLD_KEY) ??
          list[0]?.id;
        const allowed =
          list.find((item) => item.id === String(preferred))?.id ??
          list[0]?.id;

        if (allowed) {
          await loadHousehold(allowed);
        } else {
          setData(emptyData);
          setStatus("ready");
        }
      })
      .catch((reason) => {
        if (cancelled) return;
        setStatus("error");
        captureError(reason);
      });

    return () => {
      cancelled = true;
    };
  }, [
    captureError,
    enabled,
    loadHousehold,
    loadHouseholds,
    requestedHouseholdId,
  ]);

  const runMutation = useCallback(
    async <T,>(operation: () => Promise<T>, reload = true) => {
      setMutating(true);
      setError(null);
      setFieldErrors({});
      try {
        const result = await operation();
        if (reload) await refresh();
        return result;
      } catch (reason) {
        captureError(reason);
        throw reason;
      } finally {
        setMutating(false);
      }
    },
    [captureError, refresh],
  );

  const householdId = activeHouseholdId || data.household.id;
  const activeList = openShoppingList(data.shoppingLists);

  const actions = useMemo(
    () => ({
      refresh,
      clearError: () => {
        setError(null);
        setFieldErrors({});
      },
      switchHousehold: async (id: string) => {
        if (!id || id === householdId) return;
        await loadHousehold(id);
      },
      createHousehold: async (name: string) => {
        const created = normalizeHousehold(
          await runMutation(
            () =>
              householdApi.households.create({
                name: name.trim(),
                currency: "EUR",
                timezone: "Europe/Madrid",
              }),
            false,
          ),
        );
        await loadHouseholds();
        await loadHousehold(created.id);
        return created;
      },
      updateHousehold: (payload: HouseholdUpdate) =>
        runMutation(() =>
          householdApi.households.update(householdId, payload),
        ),
      createCategory: (payload: Omit<Category, "id" | "rowVersion">) =>
        runMutation(() =>
          householdApi.categories.create(householdId, payload),
        ),
      removeCategory: (categoryId: string) =>
        runMutation(() =>
          householdApi.categories.remove(householdId, categoryId),
        ),
      addExpense: (
        expense: Omit<
          Expense,
          "id" | "householdId" | "createdAt" | "rowVersion"
        >,
      ) =>
        runMutation(() =>
          householdApi.expenses.create(householdId, expense),
        ),
      addSettlement: (
        settlement: Omit<
          Settlement,
          "id" | "householdId" | "status" | "rowVersion"
        >,
      ) =>
        runMutation(() =>
          householdApi.settlements.create(householdId, settlement),
        ),
      addTask: (
        task: Omit<
          HouseholdTask,
          "id" | "householdId" | "createdAt" | "checklist" | "rowVersion"
        >,
      ) =>
        runMutation(() =>
          householdApi.tasks.create(householdId, {
            ...task,
            checklist: [],
          }),
        ),
      setTaskStatus: (taskId: string, nextStatus: HouseholdTask["status"]) => {
        const task = data.tasks.find((item) => item.id === taskId);
        return runMutation(() =>
          householdApi.tasks.setStatus(
            householdId,
            taskId,
            nextStatus,
            task?.rowVersion,
          ),
        );
      },
      toggleChecklist: (taskId: string, checklistId: string) => {
        const task = data.tasks.find((item) => item.id === taskId);
        const item = task?.checklist.find(
          (checklist) => checklist.id === checklistId,
        );
        if (!item) return Promise.resolve();
        return runMutation(() =>
          householdApi.tasks.updateChecklist(
            householdId,
            taskId,
            checklistId,
            {
              completed: !item.completed,
              rowVersion: item.rowVersion ?? task?.rowVersion,
            },
          ),
        );
      },
      addShoppingItem: (
        item: Omit<
          ShoppingItem,
          "id" | "createdAt" | "purchased" | "rowVersion"
        >,
      ) =>
        runMutation(async () => {
          // The API also returns historical, closed lists. Adding an item to
          // one of those raises a server-side reference error, so always use
          // the open list and create the current one when none exists.
          const list = activeList?.id
            ? activeList
            : normalizeShoppingList(
                await householdApi.shopping.createList(householdId, {
                  name: "Lista de compra",
                }),
                householdId,
              );
          return householdApi.shopping.addItem(householdId, list.id, item);
        }),
      toggleShoppingItem: (itemId: string) => {
        const item = activeList?.items.find(
          (candidate) => candidate.id === itemId,
        );
        if (!activeList?.id || !item) return Promise.resolve();
        return runMutation(() =>
          householdApi.shopping.updateItem(
            householdId,
            activeList.id,
            itemId,
            {
              purchased: !item.purchased,
              rowVersion: item.rowVersion,
            },
          ),
        );
      },
      updateShoppingItemPrice: (itemId: string, actualPrice: number) => {
        const item = activeList?.items.find(
          (candidate) => candidate.id === itemId,
        );
        if (!activeList?.id || !item?.purchased) return Promise.resolve();
        return runMutation(() =>
          householdApi.shopping.updateItem(
            householdId,
            activeList.id,
            itemId,
            {
              actualPrice,
              rowVersion: item.rowVersion,
            },
          ),
        );
      },
      removeShoppingItem: (itemId: string) => {
        const item = activeList?.items.find(
          (candidate) => candidate.id === itemId,
        );
        if (!activeList?.id) return Promise.resolve();
        return runMutation(() =>
          householdApi.shopping.removeItem(
            householdId,
            activeList.id,
            itemId,
            item?.rowVersion,
          ),
        );
      },
      finalizeShopping: (amount: number, paidByMemberId: string) => {
        const itemIds =
          activeList?.items
            .filter((item) => item.purchased && !item.expenseId)
            .map((item) => item.id) ?? [];
        if (!activeList?.id || !itemIds.length) {
          return Promise.reject(
            new Error("Marcá al menos un producto comprado para finalizar."),
          );
        }
        return runMutation(() =>
          householdApi.shopping.finalize(householdId, activeList.id, {
            itemIds,
            totalAmount: amount,
            paidByMemberId,
            splitType: "equal",
            participants: data.members
              .filter((member) => member.active)
              .map((member) => ({ memberId: member.id })),
            date: new Date().toISOString(),
          }),
        );
      },
      addRecurringExpense: (
        recurring: Omit<
          RecurringExpense,
          "id" | "householdId" | "rowVersion"
        >,
      ) =>
        runMutation(() =>
          householdApi.recurring.create(householdId, recurring),
        ),
      toggleRecurringStatus: (id: string) => {
        const recurring = data.recurringExpenses.find(
          (item) => item.id === id,
        );
        if (!recurring) return Promise.resolve();
        return runMutation(() =>
          householdApi.recurring.setStatus(
            householdId,
            id,
            recurring.status === "active" ? "paused" : "active",
            recurring.rowVersion,
          ),
        );
      },
      createInvitation: async (input: {
        email?: string;
        mode: HouseholdInvitation["mode"];
        role?: HouseholdInvitation["role"];
      }) => {
        const created = normalizeInvitation(
          await runMutation(
            () =>
              householdApi.invitations.create(householdId, {
                ...input,
                role: input.role ?? "member",
              }),
            false,
          ),
          householdId,
        );
        setInvitations((current) => [created, ...current]);
        return created;
      },
      revokeInvitation: (invitationId: string) =>
        runMutation(async () => {
          await householdApi.invitations.revoke(
            householdId,
            invitationId,
          );
          setInvitations((current) =>
            current.map((invite) =>
              invite.id === invitationId
                ? { ...invite, status: "revoked" }
                : invite,
            ),
          );
        }, false),
      toggleMemberStatus: (id: string) => {
        const member = data.members.find((item) => item.id === id);
        if (!member) return Promise.resolve();
        return runMutation(() =>
          householdApi.members.setStatus(
            householdId,
            id,
            !member.active,
            member.rowVersion,
          ),
        );
      },
    }),
    [
      activeList,
      data.members,
      data.recurringExpenses,
      data.tasks,
      householdId,
      loadHousehold,
      loadHouseholds,
      refresh,
      runMutation,
    ],
  );

  return {
    data,
    dashboard,
    households,
    invitations,
    balances,
    suggestedTransfers,
    status,
    hydrated: status === "ready" || status === "error",
    loading: status === "loading",
    mutating,
    error,
    fieldErrors,
    actions,
  };
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of [
      "items",
      "Items",
      "data",
      "Data",
      "results",
      "Results",
      "events",
      "Events",
      "activity",
      "activities",
    ]) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }
  return [];
}

function settledArray<T>(
  result: PromiseSettledResult<unknown>,
): T[] {
  return result.status === "fulfilled" ? asArray<T>(result.value) : [];
}

function stringId(value: unknown) {
  return value == null ? "" : String(value);
}

function normalizeHouseholdSummary(
  input: HouseholdSummary,
): HouseholdSummary {
  return {
    ...input,
    id: stringId(input.id),
    memberCount: Number(input.memberCount ?? 0),
  };
}

function normalizeHousehold(input: Household): Household {
  return {
    ...input,
    id: stringId(input.id),
    currency: input.currency ?? "EUR",
    timezone: input.timezone ?? "Europe/Madrid",
    createdByUserId: input.createdByUserId
      ? stringId(input.createdByUserId)
      : undefined,
  };
}

function normalizeMember(
  input: HouseholdMember,
  householdId: string,
): HouseholdMember {
  const name = input.name || input.email || "Integrante";
  return {
    ...input,
    id: stringId(input.id),
    householdId,
    userId: input.userId ? stringId(input.userId) : undefined,
    name,
    initials:
      input.initials ||
      name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
    color: input.color || "#4F7C65",
    role: input.role ?? "member",
    active: input.active ?? true,
    joinedAt: input.joinedAt ?? new Date().toISOString(),
  };
}

function normalizeCategory(input: Category): Category {
  return {
    ...input,
    id: stringId(input.id),
    color: input.color || "#4F7C65",
    type: input.type ?? "expense",
  };
}

function normalizeExpense(
  input: Expense,
  householdId: string,
): Expense {
  return {
    ...input,
    id: stringId(input.id),
    householdId,
    categoryId: stringId(input.categoryId),
    paidByMemberId: stringId(input.paidByMemberId),
    amount: Number(input.amount),
    participants: asArray<Expense["participants"][number]>(
      input.participants,
    ).map((participant) => ({
      ...participant,
      memberId: stringId(participant.memberId),
      amount: Number(participant.amount ?? 0),
    })),
  };
}

function normalizeRecurring(
  input: RecurringExpense,
  householdId: string,
): RecurringExpense {
  const source = input as RecurringExpense & {
    participants?: Array<{ memberId: string | number }>;
  };
  return {
    ...input,
    id: stringId(input.id),
    householdId,
    categoryId: stringId(input.categoryId),
    paidByMemberId: stringId(input.paidByMemberId),
    participantIds: Array.isArray(input.participantIds)
      ? input.participantIds.map(stringId)
      : asArray<{ memberId: string | number }>(
          source.participants,
        ).map((participant) => stringId(participant.memberId)),
    estimatedAmount:
      input.estimatedAmount == null
        ? null
        : Number(input.estimatedAmount),
  };
}

function normalizeSettlement(
  input: Settlement,
  householdId: string,
): Settlement {
  return {
    ...input,
    id: stringId(input.id),
    householdId,
    fromMemberId: stringId(input.fromMemberId),
    toMemberId: stringId(input.toMemberId),
    amount: Number(input.amount),
  };
}

function normalizeTask(
  input: HouseholdTask,
  householdId: string,
): HouseholdTask {
  const source = input as HouseholdTask & { categoryName?: string };
  return {
    ...input,
    id: stringId(input.id),
    householdId,
    assignedToMemberId: input.assignedToMemberId
      ? stringId(input.assignedToMemberId)
      : undefined,
    categoryId: input.categoryId
      ? stringId(input.categoryId)
      : undefined,
    category: input.category || source.categoryName || "Sin categoría",
    checklist: asArray<HouseholdTask["checklist"][number]>(
      input.checklist,
    ).map((item, index) => ({
      ...item,
      id: stringId(item.id),
      order: item.order ?? index + 1,
    })),
  };
}

function normalizeShoppingList(
  input: ShoppingList,
  householdId: string,
): ShoppingList {
  return {
    ...input,
    id: stringId(input.id),
    householdId,
    weekStart: input.weekStart ?? input.weekOf,
    weekOf: input.weekOf ?? input.weekStart ?? new Date().toISOString(),
    items: asArray<ShoppingItem>(input.items).map((item) => {
      const source = item as ShoppingItem & { categoryName?: string };
      return {
        ...item,
        id: stringId(item.id),
        categoryId: item.categoryId
          ? stringId(item.categoryId)
          : undefined,
        category: item.category || source.categoryName || "Otros",
        addedByMemberId: stringId(item.addedByMemberId),
        quantity: Number(item.quantity ?? 1),
        estimatedPrice:
          item.estimatedPrice == null
            ? undefined
            : Number(item.estimatedPrice),
        actualPrice:
          item.actualPrice == null ? undefined : Number(item.actualPrice),
      };
    }),
  };
}

function normalizeActivity(
  input: Activity,
  householdId: string,
): Activity {
  return {
    ...input,
    id: stringId(input.id),
    householdId,
    memberId: input.memberId ? stringId(input.memberId) : undefined,
  };
}

function normalizeInvitation(
  input: HouseholdInvitation,
  householdId: string,
): HouseholdInvitation {
  const inviteUrl = input.inviteUrl;
  const token = invitationToken(input);
  return {
    ...input,
    id: stringId(input.id),
    householdId,
    token,
    inviteUrl,
  };
}

function normalizeBalanceResponse(input: BalanceResponse): {
  members: BalanceSummary[];
  suggestedTransfers: SuggestedTransfer[];
} {
  const source = (input ?? {}) as BalanceResponse;
  return {
    members: asArray<BalanceSummary>(source.members).map((item) => ({
      ...item,
      memberId: stringId(item.memberId),
      paid: Number(item.paid ?? 0),
      owed: Number(item.owed ?? 0),
      settlementsSent: Number(item.settlementsSent ?? 0),
      settlementsReceived: Number(item.settlementsReceived ?? 0),
      balance: Number(item.balance ?? 0),
    })),
    suggestedTransfers: asArray<SuggestedTransfer>(
      source.suggestedTransfers,
    ).map((item) => ({
      ...item,
      fromMemberId: stringId(item.fromMemberId),
      toMemberId: stringId(item.toMemberId),
      amount: Number(item.amount ?? 0),
    })),
  };
}
