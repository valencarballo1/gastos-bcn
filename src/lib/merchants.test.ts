import { describe, expect, it } from "vitest";
import { detectMerchant, suggestCategoryId } from "./merchants";
import type { Category } from "@/types";

const categories: Category[] = [
  { id: "1", name: "Supermercado", color: "#526a5a", type: "expense" },
  { id: "2", name: "Hogar y servicios", color: "#557d92", type: "expense" },
  { id: "3", name: "Suscripciones", color: "#cf983d", type: "expense" },
  { id: "4", name: "Limpieza", color: "#d96c4d", type: "shopping" },
];

describe("detectMerchant", () => {
  it("reconoce comercios sin importar mayúsculas ni acentos", () => {
    expect(detectMerchant("Compra en MERCADONA")?.label).toBe("Mercadona");
    expect(detectMerchant("Suscripción Claude")?.label).toBe("Claude");
  });

  it("no inventa un comercio cuando no hay ninguno", () => {
    expect(detectMerchant("regalo de cumpleaños")).toBeNull();
    expect(detectMerchant("")).toBeNull();
  });
});

describe("suggestCategoryId", () => {
  it("propone la categoría del hogar que encaja con el comercio", () => {
    expect(suggestCategoryId("Mercadona", categories)).toBe("1");
    expect(suggestCategoryId("Recibo de Endesa", categories)).toBe("2");
    expect(suggestCategoryId("Netflix", categories)).toBe("3");
  });

  it("deja la categoría como está si no hay ninguna razonable", () => {
    expect(suggestCategoryId("algo raro", categories)).toBeUndefined();
    // "Limpieza" es de lista de la compra, no de gastos.
    expect(suggestCategoryId("Mercadona", [categories[3]])).toBeUndefined();
  });
});
