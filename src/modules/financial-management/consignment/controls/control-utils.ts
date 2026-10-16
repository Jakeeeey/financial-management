export function todayInManila() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatPeso(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value ?? 0);
}

export function formatManilaDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const withOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}+08:00`;
  const date = new Date(withOffset);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function isOlderThanTwoDays(value: string | null | undefined) {
  if (!value) return false;
  const withOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}+08:00`;
  const submitted = new Date(withOffset).getTime();
  return Number.isFinite(submitted) && Date.now() - submitted > 48 * 60 * 60 * 1000;
}
