import type {
  Expense,
  HouseholdData,
  HouseholdMember,
  HouseholdTask,
  RecurringExpense,
  Settlement,
  ShoppingItem,
} from "@/types";
import { requestJson } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://gastosApiBCN.somee.com/api";

/**
 * Adaptador de la futura API. La demo usa useHousehold + localStorage; al habilitar
 * el backend, este servicio puede reemplazar ese repositorio sin cambiar las vistas.
 */
export const householdApi = {
  dashboard: (householdId: string) =>
    requestJson<HouseholdData>(`${API_BASE}/hogares/${householdId}/dashboard`),
  expenses: {
    list: (householdId: string) =>
      requestJson<Expense[]>(`${API_BASE}/hogares/${householdId}/gastos`),
    create: (
      householdId: string,
      payload: Omit<Expense, "id" | "householdId" | "createdAt">,
    ) =>
      requestJson<Expense>(`${API_BASE}/hogares/${householdId}/gastos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  },
  members: {
    list: (householdId: string) =>
      requestJson<HouseholdMember[]>(`${API_BASE}/hogares/${householdId}/integrantes`),
  },
  recurring: {
    list: (householdId: string) =>
      requestJson<RecurringExpense[]>(
        `${API_BASE}/hogares/${householdId}/gastos-recurrentes`,
      ),
  },
  settlements: {
    create: (
      householdId: string,
      payload: Omit<Settlement, "id" | "householdId" | "status">,
    ) =>
      requestJson<Settlement>(`${API_BASE}/hogares/${householdId}/liquidaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  },
  tasks: {
    list: (householdId: string) =>
      requestJson<HouseholdTask[]>(`${API_BASE}/hogares/${householdId}/tareas`),
  },
  shopping: {
    addItem: (
      householdId: string,
      listId: string,
      payload: Omit<ShoppingItem, "id" | "createdAt" | "purchased">,
    ) =>
      requestJson<ShoppingItem>(
        `${API_BASE}/hogares/${householdId}/listas-compra/${listId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      ),
  },
};
