import type {
  BalanceSummary,
  Expense,
  HouseholdMember,
  Settlement,
  SuggestedTransfer,
} from "@/types";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateBalances(
  members: HouseholdMember[],
  expenses: Expense[],
  settlements: Settlement[],
): BalanceSummary[] {
  const balances = new Map<string, BalanceSummary>();

  members.forEach((member) =>
    balances.set(member.id, {
      memberId: member.id,
      paid: 0,
      owed: 0,
      settlementsSent: 0,
      settlementsReceived: 0,
      balance: 0,
    }),
  );

  expenses
    .filter((expense) => expense.status === "paid")
    .forEach((expense) => {
      const payer = balances.get(expense.paidByMemberId);
      if (payer) payer.paid += expense.amount;
      expense.participants.forEach((participant) => {
        const member = balances.get(participant.memberId);
        if (member) member.owed += participant.amount;
      });
    });

  settlements
    .filter((settlement) => settlement.status === "active")
    .forEach((settlement) => {
      const sender = balances.get(settlement.fromMemberId);
      const receiver = balances.get(settlement.toMemberId);
      if (sender) sender.settlementsSent += settlement.amount;
      if (receiver) receiver.settlementsReceived += settlement.amount;
    });

  return [...balances.values()].map((summary) => ({
    ...summary,
    paid: money(summary.paid),
    owed: money(summary.owed),
    settlementsSent: money(summary.settlementsSent),
    settlementsReceived: money(summary.settlementsReceived),
    balance: money(
      summary.paid -
        summary.owed +
        summary.settlementsSent -
        summary.settlementsReceived,
    ),
  }));
}

export function simplifyDebts(balances: BalanceSummary[]): SuggestedTransfer[] {
  const creditors = balances
    .filter((item) => item.balance > 0.009)
    .map((item) => ({ memberId: item.memberId, amount: item.balance }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((item) => item.balance < -0.009)
    .map((item) => ({ memberId: item.memberId, amount: Math.abs(item.balance) }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SuggestedTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = money(Math.min(creditor.amount, debtor.amount));

    if (amount > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount,
      });
    }

    creditor.amount = money(creditor.amount - amount);
    debtor.amount = money(debtor.amount - amount);
    if (creditor.amount <= 0.009) creditorIndex += 1;
    if (debtor.amount <= 0.009) debtorIndex += 1;
  }

  return transfers;
}
