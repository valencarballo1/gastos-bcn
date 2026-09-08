import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpenseForm } from "./ExpenseForm";
import type { HouseholdData } from "@/types";

const data = householdData();

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ExpenseForm data={data} onSubmit={onSubmit} onCancel={() => undefined} />,
  );
  return onSubmit;
}

const amountField = () => screen.getByLabelText("Importe del gasto");
const descriptionField = () => screen.getByRole("textbox", { name: "¿Qué fue?" });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));

describe("ExpenseForm", () => {
  it("acepta decimales escritos con coma", async () => {
    const onSubmit = renderForm();
    fireEvent.change(amountField(), { target: { value: "12,50" } });
    fireEvent.change(descriptionField(), { target: { value: "Mercadona" } });
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      amount: 12.5,
      description: "Mercadona",
    });
  });

  it("acepta decimales escritos con punto", async () => {
    const onSubmit = renderForm();
    fireEvent.change(amountField(), { target: { value: "9.99" } });
    fireEvent.change(descriptionField(), { target: { value: "Farmacia" } });
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].amount).toBe(9.99);
  });

  it("reparte los céntimos sin perder ni un euro", async () => {
    const onSubmit = renderForm();
    fireEvent.change(amountField(), { target: { value: "10" } });
    fireEvent.change(descriptionField(), { target: { value: "Cena" } });
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const participants = onSubmit.mock.calls[0][0].participants;
    expect(participants).toEqual([
      { memberId: "1", amount: 3.34 },
      { memberId: "2", amount: 3.33 },
      { memberId: "3", amount: 3.33 },
    ]);
  });

  it("sugiere la categoría del comercio mientras se escribe", async () => {
    const onSubmit = renderForm();
    fireEvent.change(amountField(), { target: { value: "45,90" } });
    fireEvent.change(descriptionField(), { target: { value: "Compra Mercadona" } });

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveValue(
        "10",
      ),
    );
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].categoryId).toBe("10");
  });

  it("no deja guardar un reparto por importes que no cuadra", async () => {
    const onSubmit = renderForm();
    fireEvent.change(amountField(), { target: { value: "30" } });
    fireEvent.change(descriptionField(), { target: { value: "Compra" } });
    fireEvent.click(screen.getByRole("button", { name: "Importes" }));
    fireEvent.change(screen.getByLabelText("Importe de Ana"), {
      target: { value: "5" },
    });
    save();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Falta repartir 5,00 €",
      ),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rechaza un importe vacío con un mensaje que explica los decimales", async () => {
    const onSubmit = renderForm();
    fireEvent.change(descriptionField(), { target: { value: "Algo" } });
    save();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Podés usar decimales: 12,50",
      ),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

function householdData(): HouseholdData {
  const members = [
    ["1", "Ana"],
    ["2", "Bruno"],
    ["3", "Carla"],
  ].map(([id, name]) => ({
    id,
    householdId: "1",
    name,
    initials: name.slice(0, 2),
    color: "#526a5a",
    role: "member" as const,
    active: true,
    joinedAt: "2026-01-01T00:00:00Z",
  }));

  return {
    household: {
      id: "1",
      name: "Casa Clara",
      currency: "EUR",
      timezone: "Europe/Madrid",
    },
    members,
    categories: [
      { id: "9", name: "Otros", color: "#657069", type: "expense" },
      { id: "10", name: "Supermercado", color: "#526a5a", type: "expense" },
    ],
    expenses: [],
    recurringExpenses: [],
    settlements: [],
    tasks: [],
    shoppingLists: [],
    activities: [],
    mailReceipts: [],
  };
}
