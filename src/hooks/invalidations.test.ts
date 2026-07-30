import { describe, expect, it } from "vitest";
import { MUTATION_INVALIDATIONS } from "./useHousehold";

describe("invalidaciones derivadas", () => {
  it("refresca balances y dashboard después de un gasto", () => {
    expect(MUTATION_INVALIDATIONS.expense).toEqual(
      expect.arrayContaining(["expenses", "balances", "dashboard"]),
    );
  });

  it("refresca gastos al finalizar una compra", () => {
    expect(MUTATION_INVALIDATIONS.shopping).toEqual(
      expect.arrayContaining(["shopping", "expenses", "balances"]),
    );
  });

  it("refresca calendario y reportes después de una tarea", () => {
    expect(MUTATION_INVALIDATIONS.task).toEqual(
      expect.arrayContaining(["tasks", "calendar", "reports", "activity"]),
    );
  });
});
