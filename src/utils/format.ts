export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);

export const formatDate = (
  value: string,
  options?: Intl.DateTimeFormatOptions,
  timeZone?: string,
) =>
  new Intl.DateTimeFormat("es-ES", {
    ...(options ?? { day: "numeric", month: "short" }),
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));

export const formatLongDate = (value: string, timeZone?: string) =>
  formatDate(
    value,
    { day: "numeric", month: "long", year: "numeric" },
    timeZone,
  );

export const daysUntil = (value: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
};

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
