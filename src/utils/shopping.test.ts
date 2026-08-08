import { describe, expect, it } from "vitest";
import { openShoppingList, openShoppingListsFirst } from "./shopping";
import type { ShoppingList } from "@/types";

describe("lista de compra activa", () => {
  it("elige la lista abierta aunque la API devuelva antes una cerrada", () => {
    const closed = list("old", "closed");
    const open = list("current", "open");

    expect(openShoppingList([closed, open])).toBe(open);
    expect([closed, open].sort(openShoppingListsFirst)[0]).toBe(open);
  });

  it("no reutiliza una lista cerrada", () => {
    expect(openShoppingList([list("old", "closed")])).toBeUndefined();
  });
});

function list(id: string, status: ShoppingList["status"]): ShoppingList {
  return {
    id,
    householdId: "1",
    name: "Compra",
    weekOf: "2026-07-31",
    status,
    items: [],
  };
}
