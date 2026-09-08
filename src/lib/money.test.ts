import { describe, expect, it } from "vitest";
import {
  fixedSplitMatchesTotal,
  formatAmountInput,
  parseAmount,
  previewEqualSplit,
  sanitizeAmountInput,
  toCents,
} from "./money";

describe("money", () => {
  it("normaliza importes a céntimos", () => {
    expect(toCents("10,01")).toBe(1001);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it("valida un reparto fijo sin errores de coma flotante", () => {
    expect(fixedSplitMatchesTotal(100, [33.33, 33.33, 33.34])).toBe(true);
    expect(fixedSplitMatchesTotal(100, [33.33, 33.33, 33.33])).toBe(false);
  });

  it("muestra un reparto igualitario que conserva el total exacto", () => {
    // El céntimo sobrante va a los primeros participantes, igual que el backend.
    const split = previewEqualSplit(10, ["a", "b", "c"]);
    expect(split).toEqual([
      { memberId: "a", amount: 3.34 },
      { memberId: "b", amount: 3.33 },
      { memberId: "c", amount: 3.33 },
    ]);
    expect(split.reduce((sum, item) => sum + toCents(item.amount), 0)).toBe(
      1000,
    );
  });
});

describe("parseAmount", () => {
  it("acepta coma o punto como separador decimal", () => {
    expect(parseAmount("12,50")).toBe(12.5);
    expect(parseAmount("12.50")).toBe(12.5);
    expect(parseAmount("0,05")).toBe(0.05);
  });

  it("entiende separadores de miles en ambos formatos", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("1.234")).toBe(1234);
  });

  it("trata como decimales las tres cifras que siguen a un cero", () => {
    // Un peso de ticket: 0,596 kg no son 596 kg.
    expect(parseAmount("0,596")).toBe(0.596);
    expect(parseAmount("0.500")).toBe(0.5);
  });

  it("ignora el símbolo de moneda y los espacios", () => {
    expect(parseAmount(" 42,17 € ")).toBe(42.17);
  });

  it("devuelve null cuando no hay número", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });
});

describe("sanitizeAmountInput", () => {
  it("conserva el separador que se está escribiendo", () => {
    expect(sanitizeAmountInput("12,")).toBe("12,");
    expect(sanitizeAmountInput("12.")).toBe("12.");
    expect(sanitizeAmountInput("12,5")).toBe("12,5");
  });

  it("recorta a dos decimales y descarta lo que no sea número", () => {
    expect(sanitizeAmountInput("12,505")).toBe("12,50");
    expect(sanitizeAmountInput("a1b2,c3")).toBe("12,3");
    expect(sanitizeAmountInput("1.234,56")).toBe("1234,56");
  });

  it("admite más decimales para cantidades", () => {
    expect(sanitizeAmountInput("0,5", 3)).toBe("0,5");
    expect(sanitizeAmountInput("1,2345", 3)).toBe("1,234");
  });

  it("no deja ceros a la izquierda ni comas huérfanas", () => {
    expect(sanitizeAmountInput("007")).toBe("7");
    expect(sanitizeAmountInput(",5")).toBe("0,5");
  });
});

describe("formatAmountInput", () => {
  it("escribe el importe con coma decimal", () => {
    expect(formatAmountInput(12.5)).toBe("12,50");
    expect(formatAmountInput(0)).toBe("0,00");
  });
});
