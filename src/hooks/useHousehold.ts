"use client";

import { useEffect, useMemo, useState } from "react";
import { seedHouseholdData } from "@/data/seed";
import type {
  Expense,
  HouseholdData,
  HouseholdMember,
  HouseholdTask,
  RecurringExpense,
  Settlement,
  ShoppingItem,
} from "@/types";
import { calculateBalances, simplifyDebts } from "@/utils/balances";
import { uid } from "@/utils/format";

const STORAGE_KEY = "casaclara-household-v1";

const createActivity = (
  data: HouseholdData,
  activity: Omit<HouseholdData["activities"][number], "id" | "householdId" | "date">,
) => ({
  id: uid("activity"),
  householdId: data.household.id,
  date: new Date().toISOString(),
  ...activity,
});

export function useHousehold() {
  const [data, setData] = useState<HouseholdData>(seedHouseholdData);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setData(JSON.parse(saved) as HouseholdData);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const balances = useMemo(
    () => calculateBalances(data.members, data.expenses, data.settlements),
    [data.expenses, data.members, data.settlements],
  );
  const suggestedTransfers = useMemo(() => simplifyDebts(balances), [balances]);

  const addExpense = (expense: Omit<Expense, "id" | "householdId" | "createdAt">) => {
    setData((current) => {
      const created: Expense = {
        ...expense,
        id: uid("expense"),
        householdId: current.household.id,
        createdAt: new Date().toISOString(),
      };
      const payer = current.members.find((member) => member.id === created.paidByMemberId);
      return {
        ...current,
        expenses: [created, ...current.expenses],
        activities: [
          createActivity(current, {
            memberId: created.paidByMemberId,
            entityType: "expense",
            action: "Gasto creado",
            description: `${payer?.name ?? "Un integrante"} registró ${created.description}`,
          }),
          ...current.activities,
        ],
      };
    });
  };

  const addSettlement = (
    settlement: Omit<Settlement, "id" | "householdId" | "status">,
  ) => {
    setData((current) => {
      const created: Settlement = {
        ...settlement,
        id: uid("settlement"),
        householdId: current.household.id,
        status: "active",
      };
      const sender = current.members.find((member) => member.id === created.fromMemberId);
      const receiver = current.members.find((member) => member.id === created.toMemberId);
      return {
        ...current,
        settlements: [created, ...current.settlements],
        activities: [
          createActivity(current, {
            memberId: created.fromMemberId,
            entityType: "settlement",
            action: "Liquidación registrada",
            description: `${sender?.name} pagó a ${receiver?.name}`,
          }),
          ...current.activities,
        ],
      };
    });
  };

  const addTask = (
    task: Omit<HouseholdTask, "id" | "householdId" | "createdAt" | "checklist">,
  ) => {
    setData((current) => {
      const created: HouseholdTask = {
        ...task,
        id: uid("task"),
        householdId: current.household.id,
        createdAt: new Date().toISOString(),
        checklist: [],
      };
      return {
        ...current,
        tasks: [created, ...current.tasks],
        activities: [
          createActivity(current, {
            memberId: created.assignedToMemberId,
            entityType: "task",
            action: "Tarea creada",
            description: `Se creó la tarea ${created.title}`,
          }),
          ...current.activities,
        ],
      };
    });
  };

  const setTaskStatus = (taskId: string, status: HouseholdTask["status"]) => {
    setData((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) return current;
      return {
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status,
                completedAt: status === "completed" ? new Date().toISOString() : undefined,
              }
            : item,
        ),
        activities:
          status === "completed"
            ? [
                createActivity(current, {
                  memberId: task.assignedToMemberId,
                  entityType: "task",
                  action: "Tarea completada",
                  description: `Se completó ${task.title}`,
                }),
                ...current.activities,
              ]
            : current.activities,
      };
    });
  };

  const toggleChecklist = (taskId: string, checklistId: string) => {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              checklist: task.checklist.map((item) =>
                item.id === checklistId ? { ...item, completed: !item.completed } : item,
              ),
            }
          : task,
      ),
    }));
  };

  const addShoppingItem = (
    item: Omit<ShoppingItem, "id" | "createdAt" | "purchased">,
  ) => {
    setData((current) => {
      const created: ShoppingItem = {
        ...item,
        id: uid("item"),
        purchased: false,
        createdAt: new Date().toISOString(),
      };
      const [activeList, ...otherLists] = current.shoppingLists;
      return {
        ...current,
        shoppingLists: [{ ...activeList, items: [created, ...activeList.items] }, ...otherLists],
        activities: [
          createActivity(current, {
            memberId: created.addedByMemberId,
            entityType: "shopping",
            action: "Producto agregado",
            description: `Se agregó ${created.name} a la lista`,
          }),
          ...current.activities,
        ],
      };
    });
  };

  const toggleShoppingItem = (itemId: string) => {
    setData((current) => ({
      ...current,
      shoppingLists: current.shoppingLists.map((list, index) =>
        index === 0
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId ? { ...item, purchased: !item.purchased } : item,
              ),
            }
          : list,
      ),
    }));
  };

  const removeShoppingItem = (itemId: string) => {
    setData((current) => ({
      ...current,
      shoppingLists: current.shoppingLists.map((list, index) =>
        index === 0 ? { ...list, items: list.items.filter((item) => item.id !== itemId) } : list,
      ),
    }));
  };

  const finalizeShopping = (amount: number, paidByMemberId: string) => {
    setData((current) => {
      const list = current.shoppingLists[0];
      const purchased = list.items.filter((item) => item.purchased && !item.expenseId);
      if (!purchased.length) return current;
      const activeMembers = current.members.filter((member) => member.active);
      const base = Math.floor((amount * 100) / activeMembers.length) / 100;
      let allocated = 0;
      const participants = activeMembers.map((member, index) => {
        const share =
          index === activeMembers.length - 1
            ? Math.round((amount - allocated) * 100) / 100
            : base;
        allocated += share;
        return { memberId: member.id, amount: share };
      });
      const expenseId = uid("expense");
      const expense: Expense = {
        id: expenseId,
        householdId: current.household.id,
        description: list.name,
        categoryId: "cat-market",
        amount,
        currency: "EUR",
        paidByMemberId,
        date: new Date().toISOString(),
        splitType: "equal",
        participants,
        status: "paid",
        createdAt: new Date().toISOString(),
      };
      return {
        ...current,
        expenses: [expense, ...current.expenses],
        shoppingLists: current.shoppingLists.map((shoppingList, index) =>
          index === 0
            ? {
                ...shoppingList,
                items: shoppingList.items.map((item) =>
                  purchased.some((bought) => bought.id === item.id)
                    ? { ...item, expenseId }
                    : item,
                ),
              }
            : shoppingList,
        ),
        activities: [
          createActivity(current, {
            memberId: paidByMemberId,
            entityType: "shopping",
            action: "Compra finalizada",
            description: `Se convirtió ${list.name} en un gasto compartido`,
          }),
          ...current.activities,
        ],
      };
    });
  };

  const addRecurringExpense = (
    recurring: Omit<RecurringExpense, "id" | "householdId">,
  ) => {
    setData((current) => {
      const created: RecurringExpense = {
        ...recurring,
        id: uid("recurring"),
        householdId: current.household.id,
      };
      return {
        ...current,
        recurringExpenses: [created, ...current.recurringExpenses],
        activities: [
          createActivity(current, {
            memberId: created.paidByMemberId,
            entityType: "recurring",
            action: "Gasto fijo creado",
            description: `Se creó el gasto fijo ${created.name}`,
          }),
          ...current.activities,
        ],
      };
    });
  };

  const toggleRecurringStatus = (id: string) => {
    setData((current) => ({
      ...current,
      recurringExpenses: current.recurringExpenses.map((recurring) =>
        recurring.id === id
          ? { ...recurring, status: recurring.status === "active" ? "paused" : "active" }
          : recurring,
      ),
    }));
  };

  const addMember = (
    member: Omit<HouseholdMember, "id" | "householdId" | "joinedAt" | "active">,
  ) => {
    setData((current) => {
      const created: HouseholdMember = {
        ...member,
        id: uid("member"),
        householdId: current.household.id,
        active: true,
        joinedAt: new Date().toISOString(),
      };
      return {
        ...current,
        members: [...current.members, created],
        activities: [
          createActivity(current, {
            memberId: created.id,
            entityType: "member",
            action: "Integrante agregado",
            description: `${created.name} se unió al hogar`,
          }),
          ...current.activities,
        ],
      };
    });
  };

  const toggleMemberStatus = (id: string) => {
    setData((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.id === id ? { ...member, active: !member.active } : member,
      ),
    }));
  };

  const resetDemo = () => {
    setData(seedHouseholdData);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return {
    data,
    hydrated,
    balances,
    suggestedTransfers,
    actions: {
      addExpense,
      addSettlement,
      addTask,
      setTaskStatus,
      toggleChecklist,
      addShoppingItem,
      toggleShoppingItem,
      removeShoppingItem,
      finalizeShopping,
      addRecurringExpense,
      toggleRecurringStatus,
      addMember,
      toggleMemberStatus,
      resetDemo,
    },
  };
}
