import { describe, expect, it } from "vitest";
import {
  openShoppingList,
  openShoppingListsFirst,
  parseBulkItems,
  shoppingItemPrice,
} from "./shopping";
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

describe("precio de un producto comprado", () => {
  it("prioriza el precio real sobre el estimado", () => {
    expect(shoppingItemPrice({ actualPrice: 4.25, estimatedPrice: 3.5 })).toBe(
      4.25,
    );
  });

  it("usa el estimado hasta que se carga un precio real", () => {
    expect(shoppingItemPrice({ estimatedPrice: 3.5 })).toBe(3.5);
    expect(shoppingItemPrice({})).toBe(0);
  });
});

describe("carga de varios productos a la vez", () => {
  it("separa por comas y por saltos de línea", () => {
    expect(parseBulkItems("Champú, acondicionador\njabón")).toEqual([
      { name: "Champú", quantity: 1, estimatedPrice: undefined },
      { name: "acondicionador", quantity: 1, estimatedPrice: undefined },
      { name: "jabón", quantity: 1, estimatedPrice: undefined },
    ]);
  });

  it("no confunde la coma decimal con un separador de productos", () => {
    expect(parseBulkItems("leche 1,20, pan")).toEqual([
      { name: "leche", quantity: 1, estimatedPrice: 1.2 },
      { name: "pan", quantity: 1, estimatedPrice: undefined },
    ]);
  });

  it("entiende la cantidad escrita como «2 x producto»", () => {
    expect(parseBulkItems("2 x leche 1,20")).toEqual([
      { name: "leche", quantity: 2, estimatedPrice: 1.2 },
    ]);
  });

  it("solo toma como precio lo que lleva decimales o €", () => {
    expect(parseBulkItems("agua 5")).toEqual([
      { name: "agua 5", quantity: 1, estimatedPrice: undefined },
    ]);
    expect(parseBulkItems("café 3 €")).toEqual([
      { name: "café", quantity: 1, estimatedPrice: 3 },
    ]);
  });

  it("descarta líneas vacías", () => {
    expect(parseBulkItems("  ,\n\n , ")).toEqual([]);
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
