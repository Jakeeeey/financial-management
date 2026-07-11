export function formatPHP(value: number | null | undefined) {
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP", maximumFractionDigits: 2,
  }).format(v);
}

export function formatQty(value: number | null | undefined): string {
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}
