/**
 * Utilidades de dinero.
 *
 * El punto clave: en España (y en Latinoamérica) la gente escribe los decimales
 * con coma — "12,50" — y los teclados numéricos de iOS/Android muestran la coma
 * como separador. Un `<input type="number">` descarta ese valor y devuelve una
 * cadena vacía, así que aquí trabajamos siempre con texto libre y normalizamos
 * nosotros: se acepta coma o punto, con o sin separador de miles.
 */

const NON_NUMERIC = /[^\d.,]/g;

/**
 * Convierte cualquier texto escrito por una persona en un número.
 * Acepta "12,50", "12.50", "1.234,56", "1,234.56", "12,50 €" y "12".
 * Devuelve `null` cuando no hay ningún número reconocible.
 */
export function parseAmount(
  value: string | number | null | undefined,
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (value == null) return null;

  const cleaned = String(value).replace(NON_NUMERIC, "");
  if (!/\d/.test(cleaned)) return null;

  const lastSeparator = Math.max(
    cleaned.lastIndexOf(","),
    cleaned.lastIndexOf("."),
  );

  let normalized: string;
  if (lastSeparator === -1) {
    normalized = cleaned;
  } else {
    const decimals = cleaned.slice(lastSeparator + 1);
    const whole = cleaned.slice(0, lastSeparator).replace(/[.,]/g, "");
    // Tres cifras después del último separador ("1.234", "1,234") son un
    // separador de miles, no decimales: nadie escribe milésimas de euro.
    // Salvo que delante solo haya un cero: "0,596" son 596 gramos, no 596.
    normalized =
      /^\d{3}$/.test(decimals) && whole !== "0" && whole !== ""
        ? cleaned.replace(/[.,]/g, "")
        : `${whole}.${decimals}`;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Limpia lo que la persona va escribiendo sin pelearse con el cursor:
 * quita letras y símbolos, deja un único separador decimal (el último) y
 * recorta los decimales sobrantes. Conserva el separador elegido para que
 * quien escribe "12," siga viendo "12,".
 */
export function sanitizeAmountInput(raw: string, decimals = 2): string {
  const cleaned = raw.replace(NON_NUMERIC, "");
  if (!cleaned) return "";

  const lastSeparator = Math.max(
    cleaned.lastIndexOf(","),
    cleaned.lastIndexOf("."),
  );
  if (lastSeparator === -1) return trimLeadingZeros(cleaned);

  const separator = cleaned[lastSeparator];
  const whole = trimLeadingZeros(
    cleaned.slice(0, lastSeparator).replace(/[.,]/g, ""),
  );
  const fraction = cleaned.slice(lastSeparator + 1).slice(0, decimals);
  return decimals === 0 ? whole : `${whole || "0"}${separator}${fraction}`;
}

function trimLeadingZeros(value: string) {
  return value.replace(/^0+(?=\d)/, "");
}

/** Texto listo para un campo de importe, con coma decimal. */
export function formatAmountInput(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace(".", ",");
}

/** Igual que `formatAmountInput`, pero sin ceros decimales inútiles (cantidades). */
export function formatQuantityInput(value: number): string {
  return String(Number(value.toFixed(3))).replace(".", ",");
}

export function toCents(value: number | string) {
  const amount = parseAmount(value);
  return amount === null ? 0 : Math.round(amount * 100);
}

export function fromCents(cents: number) {
  return Math.round(cents) / 100;
}

/** Redondea a céntimos evitando los errores clásicos de coma flotante. */
export function roundAmount(value: number) {
  return fromCents(Math.round(value * 100));
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

/**
 * Reparto en partes iguales sin perder céntimos.
 *
 * Reparte el resto entre los primeros participantes, exactamente igual que el
 * backend (`ExpenseRules.BuildParticipants`), para que la vista previa coincida
 * con lo que finalmente se guarda.
 */
export function previewEqualSplit(
  total: number | string,
  participantIds: string[],
) {
  if (!participantIds.length) return [];
  const cents = toCents(total);
  const base = Math.trunc(cents / participantIds.length);
  const remainder = cents % participantIds.length;

  return participantIds.map((memberId, index) => ({
    memberId,
    amount: fromCents(base + (index < remainder ? 1 : 0)),
  }));
}
