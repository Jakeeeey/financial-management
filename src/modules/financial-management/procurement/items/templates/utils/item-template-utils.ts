export function formatCurrency(val: number | string | null | undefined): string {
  const n = Number(val ?? 0);
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
}

export function toNum(val: unknown): number {
  return Number(val ?? 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "2-digit",
  });
}
