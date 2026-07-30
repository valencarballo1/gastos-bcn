import { describe, expect, it } from "vitest";
import {
  fixedSplitMatchesTotal,
  previewEqualSplit,
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
    const split = previewEqualSplit(10, ["a", "b", "c"]);
    expect(split).toEqual([
      { memberId: "a", amount: 3.33 },
      { memberId: "b", amount: 3.33 },
      { memberId: "c", amount: 3.34 },
    ]);
    expect(split.reduce((sum, item) => sum + toCents(item.amount), 0)).toBe(
      1000,
    );
  });
});
