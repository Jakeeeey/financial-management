export function formatCurrency(val: number | string | null | undefined): string {
  const n = Number(val ?? 0);
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
}