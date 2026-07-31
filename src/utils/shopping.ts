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
