export function formatJournalAmount(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
}
