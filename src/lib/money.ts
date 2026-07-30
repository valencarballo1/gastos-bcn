export function toCents(value: number | string) {
  const normalized =
    typeof value === "string" ? value.replace(",", ".") : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function fromCents(cents: number) {
  return Math.round(cents) / 100;
}

export function fixedSplitMatchesTotal(
  total: number | string,
  shares: Array<number | string>,
) {
  return (
    shares.reduce<number>((sum, share) => sum + toCents(share), 0) ===
    toCents(total)
  );
}

export function previewEqualSplit(
  total: number | string,
  participantIds: string[],
) {
  if (!participantIds.length) return [];
  const cents = toCents(total);
  const base = Math.floor(cents / participantIds.length);
  let allocated = 0;

  return participantIds.map((memberId, index) => {
    const share =
      index === participantIds.length - 1 ? cents - allocated : base;
    allocated += share;
    return { memberId, amount: fromCents(share) };
  });
}
