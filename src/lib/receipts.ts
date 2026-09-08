import { parseAmount } from "@/lib/money";
import {
  detectMerchant,
  normalizeText,
  type CategoryHint,
} from "@/lib/merchants";

/**
 * Lectura de tickets y facturas que llegan por correo.
 *
 * La entrada es el correo tal cual (remitente, asunto y cuerpo en texto plano);
 * la salida es lo que hace falta para crear un gasto: comercio, fecha, total y,
 * cuando el ticket los trae, los productos línea por línea.
 *
 * Nada de esto se guarda solo: el resultado va a la bandeja de revisión y la
 * persona confirma. Por eso preferimos avisar con `confidence: "low"` antes que
 * adivinar.
 */

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitPrice?: number;
  amount: number;
}

export interface RawEmail {
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
}

export interface ParsedReceipt {
  merchant: string;
  categoryHint: CategoryHint | null;
  date: string;
  total: number | null;
  /** Moneda detectada en el correo. Si no es EUR hay que revisar el importe. */
  currency: string;
  lines: ReceiptLine[];
  confidence: "high" | "low";
  warnings: string[];
}

/** Etiquetas de total, de la más específica a la más genérica. */
const TOTAL_LABELS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /total\s*a\s*pagar/i, weight: 100 },
  { pattern: /importe\s*total/i, weight: 95 },
  { pattern: /total\s*(?:de\s*la\s*)?compra/i, weight: 92 },
  { pattern: /total\s*factura/i, weight: 90 },
  { pattern: /total\s*charged/i, weight: 88 },
  { pattern: /amount\s*(?:due|paid|charged)/i, weight: 86 },
  { pattern: /total\s*cobrado/i, weight: 84 },
  { pattern: /importe\s*a\s*cargar/i, weight: 82 },
  { pattern: /^\s*total\b/i, weight: 70 },
  { pattern: /\btotal\b/i, weight: 60 },
  { pattern: /^\s*importe\b/i, weight: 50 },
];

// Un importe suelto dentro de una línea: 12,50 | 1.234,56 | 12.50 | 1,234.56
const AMOUNT = /\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2}|\d+/g;
const CURRENCY_SYMBOLS: Array<[RegExp, string]> = [
  [/€|\beur\b|euros?/i, "EUR"],
  [/\$|\busd\b|d[oó]lares?/i, "USD"],
  [/£|\bgbp\b/i, "GBP"],
];

/** Líneas que nunca son un producto aunque tengan la forma de uno. */
const NOT_A_PRODUCT =
  /\b(total|subtotal|iva|i\.v\.a|base imponible|descuento|tarjeta|efectivo|cambio|entrega|importe|cuota|impuesto|tax|propina|env[ií]o|puntos|saldo)\b/i;

export function parseReceiptEmail(email: RawEmail): ParsedReceipt {
  const body = normalizeBody(email.body);
  const lines = body.split("\n");
  const haystack = `${email.from}\n${email.subject}\n${body}`;
  const warnings: string[] = [];

  const merchant = detectMerchant(`${email.from} ${email.subject}`) ??
    detectMerchant(body);
  const merchantName = merchant?.label ?? merchantFromSender(email.from);

  const currency = detectCurrency(haystack);
  if (currency !== "EUR") {
    warnings.push(
      `El correo está en ${currency}. Revisá el importe antes de guardar: el hogar trabaja en euros.`,
    );
  }

  const total = findTotal(lines);
  if (total === null) {
    warnings.push("No encontramos el importe total en el correo.");
  }

  const products = findLines(lines);
  const sum = products.reduce((acc, item) => acc + item.amount, 0);
  if (total !== null && products.length && Math.abs(sum - total) > 0.05) {
    warnings.push(
      `Los productos suman ${sum.toFixed(2)} y el total dice ${total.toFixed(2)}: puede faltar alguna línea.`,
    );
  }

  return {
    merchant: merchantName,
    categoryHint: merchant?.hint ?? null,
    date: findDate(lines, email.receivedAt) ?? email.receivedAt,
    total,
    currency,
    lines: products,
    confidence:
      total !== null && merchant !== null && currency === "EUR"
        ? "high"
        : "low",
    warnings,
  };
}

/** Quita el HTML si el correo vino en formato enriquecido y normaliza espacios. */
export function normalizeBody(body: string) {
  const withoutHtml = /<[a-z!/][^>]*>/i.test(body)
    ? body
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<\/(p|div|tr|table|li|h[1-6])>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/t[dh]>/gi, "  ")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&euro;/gi, "€")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    : body;

  return withoutHtml
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .trim();
}

function detectCurrency(text: string) {
  for (const [pattern, code] of CURRENCY_SYMBOLS) {
    if (pattern.test(text)) return code;
  }
  return "EUR";
}

function merchantFromSender(from: string) {
  const nameMatch = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (nameMatch) return nameMatch[1].trim();
  const domain = from.match(/@([\w-]+)\./);
  if (domain) {
    return domain[1].charAt(0).toUpperCase() + domain[1].slice(1);
  }
  return from.trim() || "Sin identificar";
}

function amountsIn(line: string) {
  return (line.match(AMOUNT) ?? [])
    .map((value) => parseAmount(value))
    .filter((value): value is number => value !== null);
}

function findTotal(lines: string[]) {
  let best: { weight: number; amount: number } | null = null;

  lines.forEach((line, index) => {
    const label = TOTAL_LABELS.find((candidate) => candidate.pattern.test(line));
    if (!label) return;

    // El importe suele estar en la misma línea; en las plantillas de tabla cae
    // en la siguiente.
    const amounts = amountsIn(line.replace(/\b20\d{2}\b/g, " "));
    const candidate =
      amounts.length > 0
        ? amounts[amounts.length - 1]
        : amountsIn(lines[index + 1] ?? "")[0];

    if (candidate === undefined || candidate <= 0) return;
    // A igual peso gana el último: los resúmenes repiten el total al final.
    if (!best || label.weight >= best.weight) {
      best = { weight: label.weight, amount: candidate };
    }
  });

  return best ? (best as { amount: number }).amount : null;
}

const DATE_PATTERNS: Array<{
  pattern: RegExp;
  build: (match: RegExpMatchArray) => string | null;
}> = [
  {
    pattern: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    build: (match) => isoDate(+match[1], +match[2], +match[3]),
  },
  {
    pattern: /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/,
    build: (match) => isoDate(+match[3], +match[2], +match[1]),
  },
  {
    pattern:
      /\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})\b/i,
    build: (match) => {
      const month = SPANISH_MONTHS.indexOf(normalizeText(match[2]));
      return month < 0 ? null : isoDate(+match[3], month + 1, +match[1]);
    },
  },
];

const SPANISH_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function isoDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function findDate(lines: string[], receivedAt: string) {
  // Un ticket no puede ser posterior al correo que lo trae: si la fecha que
  // encontramos está en el futuro, es un vencimiento o un periodo, no la compra.
  const limit = new Date(receivedAt).getTime() + 86_400_000;

  for (const line of lines) {
    for (const { pattern, build } of DATE_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;
      const value = build(match);
      if (value && new Date(value).getTime() <= limit) return value;
    }
  }
  return null;
}

// "2 LECHE ENTERA 1,20 2,40" o "1 PAN 0,90"
const PRODUCT_LINE = /^(\d{1,3})\s+(.+?)\s+(\d+[.,]\d{2})(?:\s*€)?(?:\s+(\d+[.,]\d{2})(?:\s*€)?)?$/;
// "0,596 kg x 2,19 €/kg 1,31" — el nombre puede venir delante o, como hace
// Mercadona con lo que se pesa, en la línea anterior.
const WEIGHED_LINE =
  /^(?:(.+?)\s+)?(\d+[.,]\d{1,3})\s*(?:kg|g|l|ml|ud|u)?\s*(?:x|×)\s*(\d+[.,]\d{2})\s*€?\s*(?:\/\s*\w+)?\s+(\d+[.,]\d{2})\s*€?$/i;

function findLines(lines: string[]): ReceiptLine[] {
  const products: ReceiptLine[] = [];
  // Lo que se pesa se imprime en dos líneas: el nombre arriba y el peso por el
  // precio debajo, así que guardamos la anterior por si hace falta.
  let previous = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || NOT_A_PRODUCT.test(line)) {
      previous = "";
      continue;
    }

    const weighed = line.match(WEIGHED_LINE);
    if (weighed) {
      const quantity = parseAmount(weighed[2]);
      const unitPrice = parseAmount(weighed[3]);
      const amount = parseAmount(weighed[4]);
      const name = cleanName(weighed[1] ?? "") || cleanName(previous);
      previous = "";
      if (name && quantity !== null && amount !== null && amount > 0) {
        products.push({
          name,
          quantity,
          unitPrice: unitPrice ?? undefined,
          amount,
        });
      }
      continue;
    }

    const match = line.match(PRODUCT_LINE);
    if (!match) {
      previous = line;
      continue;
    }

    const quantity = Number(match[1]);
    const name = cleanName(match[2]);
    // Con dos importes el primero es el precio unitario y el segundo el total
    // de la línea; con uno solo, ese importe es el total.
    const first = parseAmount(match[3]);
    const second = match[4] ? parseAmount(match[4]) : null;
    const amount = second ?? first;
    previous = "";
    if (!name || amount === null || amount <= 0) continue;

    products.push({
      name,
      quantity: quantity || 1,
      unitPrice: second !== null ? (first ?? undefined) : undefined,
      amount,
    });
  }

  return products;
}

function cleanName(value: string) {
  return value
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.·•*-]+|[\s.·•*-]+$/g, "")
    .trim();
}
