import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSessionState } from "./api";
import { householdApi } from "./householdApi";

describe("payloads de producción", () => {
  beforeEach(() => {
    clearSessionState();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("convierte IDs numéricos y usa los nombres exactos de Swagger", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          token: "csrf-token",
          headerName: "X-CSRF-TOKEN",
        }),
      )
      .mockResolvedValue(jsonResponse({ id: 1 }));

    await householdApi.expenses.create("1", {
      description: "Compra",
      categoryId: "2",
      amount: 10,
      currency: "EUR",
      paidByMemberId: "3",
      date: "2026-07-30T12:00:00Z",
      splitType: "equal",
      participants: [{ memberId: "4", amount: 10 }],
      status: "paid",
    });

    await householdApi.tasks.create("1", {
      title: "Limpiar",
      category: "Limpieza",
      categoryId: "8",
      assignedToMemberId: "3",
      priority: "high",
      status: "pending",
      checklist: [],
    });

    await householdApi.recurring.create("1", {
      name: "Internet",
      categoryId: "2",
      estimatedAmount: 45,
      variableAmount: false,
      frequency: "monthly",
      dueDay: 5,
      paidByMemberId: "3",
      participantIds: ["3", "4"],
      splitType: "equal",
      status: "active",
      nextDueDate: "2026-08-05T12:00:00Z",
      reminderDays: 3,
    });

    await householdApi.shopping.addItem("1", "7", {
      name: "Café",
      quantity: 1,
      unit: "u",
      category: "Despensa",
      categoryId: "9",
      addedByMemberId: "3",
      priority: "normal",
    });

    const expenseBody = requestBody(1);
    expect(expenseBody).toMatchObject({
      categoryId: 2,
      paidByMemberId: 3,
      participants: [{ memberId: 4, amount: 10 }],
    });

    const taskBody = requestBody(2);
    expect(taskBody).toMatchObject({
      categoryId: 8,
      assignedToMemberId: 3,
      priority: "high",
      dueDate: null,
    });
    expect(taskBody).not.toHaveProperty("category");

    const recurringBody = requestBody(3);
    expect(recurringBody).toMatchObject({
      categoryId: 2,
      paidByMemberId: 3,
      frequencyInterval: 1,
      participants: [{ memberId: 3 }, { memberId: 4 }],
    });
    expect(recurringBody).not.toHaveProperty("participantIds");

    const shoppingBody = requestBody(4);
    expect(shoppingBody).toMatchObject({
      categoryId: 9,
      addedByMemberId: 3,
    });
    expect(shoppingBody).not.toHaveProperty("category");
  });

  it("no envía textos visibles donde la API exige IDs", async () => {
    await expect(
      Promise.resolve().then(() =>
        householdApi.tasks.create("1", {
          title: "Limpiar",
          category: "Cocina",
          categoryId: "Cocina",
          assignedToMemberId: "3",
          priority: "medium",
          status: "pending",
          checklist: [],
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_ID" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("construye el login OAuth con /api y un retorno absoluto codificado", () => {
    const returnUrl = "https://frontend.example/shopping?week=current";
    const loginUrl = householdApi.auth.googleLoginUrl(returnUrl);

    expect(loginUrl).toContain("/api/auth/google/login?returnUrl=");
    expect(loginUrl).toContain(encodeURIComponent(returnUrl));
  });
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function requestBody(callIndex: number) {
  const init = vi.mocked(fetch).mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}
