import type { Category } from "@/types";

/**
 * Comercios habituales y a qué tipo de gasto pertenecen.
 *
 * Sirve para dos cosas: sugerir la categoría mientras se escribe la
 * descripción de un gasto y, más adelante, clasificar los tickets que lleguen
 * por correo (Mercadona, Claude, Netflix…) sin tener que elegirla a mano.
 */

export type CategoryHint =
  | "supermercado"
  | "restaurante"
  | "transporte"
  | "hogar"
  | "suscripciones"
  | "salud"
  | "compras"
  | "ocio";

export interface Merchant {
  label: string;
  hint: CategoryHint;
  /** Alias en minúscula y sin acentos con los que aparece en tickets y correos. */
  keywords: string[];
}

export const MERCHANTS: Merchant[] = [
  { label: "Mercadona", hint: "supermercado", keywords: ["mercadona"] },
  { label: "Lidl", hint: "supermercado", keywords: ["lidl"] },
  { label: "Carrefour", hint: "supermercado", keywords: ["carrefour"] },
  { label: "Bonpreu", hint: "supermercado", keywords: ["bonpreu", "esclat"] },
  { label: "Consum", hint: "supermercado", keywords: ["consum"] },
  { label: "Condis", hint: "supermercado", keywords: ["condis"] },
  { label: "Caprabo", hint: "supermercado", keywords: ["caprabo"] },
  { label: "Aldi", hint: "supermercado", keywords: ["aldi"] },
  { label: "Dia", hint: "supermercado", keywords: ["dia %", "supermercados dia"] },
  { label: "Alcampo", hint: "supermercado", keywords: ["alcampo", "auchan"] },
  { label: "Eroski", hint: "supermercado", keywords: ["eroski"] },
  { label: "Ahorramas", hint: "supermercado", keywords: ["ahorramas"] },
  { label: "Mercado", hint: "supermercado", keywords: ["fruteria", "carniceria", "panaderia", "mercat"] },

  { label: "Glovo", hint: "restaurante", keywords: ["glovo"] },
  { label: "Just Eat", hint: "restaurante", keywords: ["just eat", "justeat"] },
  { label: "Uber Eats", hint: "restaurante", keywords: ["uber eats", "ubereats"] },
  { label: "Restaurante", hint: "restaurante", keywords: ["restaurante", "bar ", "cena", "almuerzo", "brunch", "cafe", "cafeteria"] },

  { label: "TMB", hint: "transporte", keywords: ["tmb", "metro", "t-usual", "t usual", "tcasual"] },
  { label: "Renfe", hint: "transporte", keywords: ["renfe", "rodalies", "cercanias"] },
  { label: "Bicing", hint: "transporte", keywords: ["bicing"] },
  { label: "Cabify", hint: "transporte", keywords: ["cabify"] },
  { label: "Uber", hint: "transporte", keywords: ["uber"] },
  { label: "Gasolina", hint: "transporte", keywords: ["repsol", "cepsa", "shell", "gasolinera", "bp "] },
  { label: "Vueling", hint: "transporte", keywords: ["vueling", "ryanair", "iberia", "easyjet"] },

  { label: "Alquiler", hint: "hogar", keywords: ["alquiler", "renta", "lloguer"] },
  { label: "Luz", hint: "hogar", keywords: ["endesa", "iberdrola", "naturgy", "holaluz", "electricidad", "luz"] },
  { label: "Agua", hint: "hogar", keywords: ["aigues", "aigua", "agua", "canal isabel"] },
  { label: "Gas", hint: "hogar", keywords: ["gas natural", "gas"] },
  { label: "Internet", hint: "hogar", keywords: ["movistar", "vodafone", "orange", "masmovil", "jazztel", "pepephone", "digi", "yoigo", "internet", "fibra"] },
  { label: "Comunidad", hint: "hogar", keywords: ["comunidad", "administrador de fincas"] },
  { label: "Seguro", hint: "hogar", keywords: ["seguro", "mapfre", "axa", "allianz", "mutua"] },

  { label: "Claude", hint: "suscripciones", keywords: ["claude", "anthropic"] },
  { label: "ChatGPT", hint: "suscripciones", keywords: ["openai", "chatgpt"] },
  { label: "Netflix", hint: "suscripciones", keywords: ["netflix"] },
  { label: "Spotify", hint: "suscripciones", keywords: ["spotify"] },
  { label: "HBO Max", hint: "suscripciones", keywords: ["hbo", "max.com"] },
  { label: "Disney+", hint: "suscripciones", keywords: ["disney"] },
  { label: "Prime Video", hint: "suscripciones", keywords: ["prime video"] },
  { label: "YouTube", hint: "suscripciones", keywords: ["youtube premium", "google youtube"] },
  { label: "iCloud", hint: "suscripciones", keywords: ["icloud", "apple.com/bill", "apple services"] },
  { label: "Google One", hint: "suscripciones", keywords: ["google one", "google storage"] },
  { label: "Gimnasio", hint: "suscripciones", keywords: ["gimnasio", "gym", "basic fit", "basic-fit", "dir "] },

  { label: "Farmacia", hint: "salud", keywords: ["farmacia", "farmacia "] },
  { label: "Dentista", hint: "salud", keywords: ["dentista", "clinica dental"] },
  { label: "Médico", hint: "salud", keywords: ["medico", "clinica", "hospital", "sanitas", "adeslas"] },

  { label: "Amazon", hint: "compras", keywords: ["amazon", "amzn"] },
  { label: "IKEA", hint: "compras", keywords: ["ikea"] },
  { label: "Decathlon", hint: "compras", keywords: ["decathlon"] },
  { label: "Leroy Merlin", hint: "compras", keywords: ["leroy merlin", "bricodepot", "bauhaus"] },
  { label: "Zara", hint: "compras", keywords: ["zara", "inditex", "bershka", "pull&bear", "mango"] },
  { label: "Primor", hint: "compras", keywords: ["primor", "druni", "sephora"] },

  { label: "Cine", hint: "ocio", keywords: ["cine", "cinesa", "yelmo", "filmin"] },
  { label: "Viaje", hint: "ocio", keywords: ["booking", "airbnb", "hotel", "hostel"] },
  { label: "Entradas", hint: "ocio", keywords: ["entradas", "ticketmaster", "concierto", "museo"] },
];

/** Sugerencias rápidas del formulario de gasto, en orden de uso probable. */
export const QUICK_MERCHANTS = [
  "Mercadona",
  "Lidl",
  "Bonpreu",
  "Restaurante",
  "Glovo",
  "Farmacia",
  "Transporte",
  "Amazon",
];

/** Palabras que identifican cada categoría del hogar por su nombre. */
const CATEGORY_KEYWORDS: Record<CategoryHint, string[]> = {
  supermercado: ["super", "mercado", "aliment", "comida", "compra", "despensa"],
  restaurante: ["restaur", "comer fuera", "bar", "delivery", "salidas", "comida"],
  transporte: ["transport", "movilidad", "coche", "auto", "gasolina", "viaje"],
  hogar: ["hogar", "casa", "alquiler", "suministro", "servicio", "luz", "agua"],
  suscripciones: ["suscrip", "subscri", "streaming", "software", "digital", "apps"],
  salud: ["salud", "farmac", "medic", "bienestar"],
  compras: ["compras", "ropa", "varios", "otros", "personal"],
  ocio: ["ocio", "entreten", "cultura", "salidas", "tiempo libre"],
};

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Busca el comercio conocido que aparece en un texto (descripción, asunto…). */
export function detectMerchant(text: string): Merchant | null {
  if (!text.trim()) return null;
  const normalized = normalizeText(text);
  let best: { merchant: Merchant; length: number } | null = null;

  for (const merchant of MERCHANTS) {
    for (const keyword of merchant.keywords) {
      if (normalized.includes(keyword) && (!best || keyword.length > best.length)) {
        best = { merchant, length: keyword.length };
      }
    }
  }

  return best?.merchant ?? null;
}

/**
 * Categoría del hogar que mejor encaja con un texto libre.
 * Devuelve `undefined` si no hay ninguna razonable: en ese caso se respeta la
 * que ya estaba elegida.
 */
export function suggestCategoryId(
  text: string,
  categories: Category[],
  type: Category["type"] = "expense",
): string | undefined {
  const merchant = detectMerchant(text);
  if (!merchant) return undefined;

  const options = categories.filter((category) => category.type === type);
  const keywords = CATEGORY_KEYWORDS[merchant.hint];
  const match = options.find((category) => {
    const name = normalizeText(category.name);
    return keywords.some((keyword) => name.includes(keyword));
  });

  return match?.id;
}
