import { parseAmount } from "@/lib/money";
import type { ShoppingList } from "@/types";

export function openShoppingList(lists: ShoppingList[]) {
  return lists.find((list) => list.status === "open");
}

export function openShoppingListsFirst(
  left: ShoppingList,
  right: ShoppingList,
) {
  return Number(right.status === "open") - Number(left.status === "open");
}

export function shoppingItemPrice(item: {
  actualPrice?: number;
  estimatedPrice?: number;
}) {
  return item.actualPrice ?? item.estimatedPrice ?? 0;
}

export interface ParsedShoppingItem {
  name: string;
  quantity: number;
  estimatedPrice?: number;
}

const QUANTITY_PREFIX = /^(\d+(?:[.,]\d+)?)\s*(?:x|×|\*)\s*/i;
// Solo se toma como precio lo que lleva decimales o un € explícito: así
// "Agua 5" sigue siendo el nombre del producto y no cinco euros.
const TRAILING_PRICE = /\s(?:€\s*)?(\d+[.,]\d{1,2}|\d+\s*€)\s*€?$/;

/**
 * Separa productos por saltos de línea, punto y coma o coma, respetando la
 * coma decimal: en "leche 1,20, pan" solo la segunda coma separa.
 */
function splitEntries(text: string) {
  const entries: string[] = [];
  let current = "";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const isDecimalComma =
      char === "," &&
      /\d/.test(text[index - 1] ?? "") &&
      /\d/.test(text[index + 1] ?? "");

    if ((char === "\n" || char === ";" || char === ",") && !isDecimalComma) {
      entries.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  entries.push(current);

  return entries.map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Convierte una lista escrita a mano en productos.
 *
 * Acepta comas, punto y coma o saltos de línea como separador, y entiende
 * atajos habituales del ticket: "2 x leche", "pan 0,90", "café 3,50 €".
 */
export function parseBulkItems(text: string): ParsedShoppingItem[] {
  return splitEntries(text)
    .map((entry) => {
      let rest = entry;
      let quantity = 1;

      const quantityMatch = rest.match(QUANTITY_PREFIX);
      if (quantityMatch) {
        quantity = parseAmount(quantityMatch[1]) ?? 1;
        rest = rest.slice(quantityMatch[0].length).trim();
      }

      let estimatedPrice: number | undefined;
      const priceMatch = rest.match(TRAILING_PRICE);
      if (priceMatch) {
        const parsed = parseAmount(priceMatch[1]);
        if (parsed !== null && parsed > 0) {
          estimatedPrice = parsed;
          rest = rest.slice(0, priceMatch.index).trim();
        }
      }

      return { name: rest || entry, quantity, estimatedPrice };
    })
    .filter((item) => Boolean(item.name));
}
