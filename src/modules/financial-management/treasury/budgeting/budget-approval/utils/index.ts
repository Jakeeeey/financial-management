export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({
  value: String(i + 1),
  label: name,
}));

export const YEAR_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 7 },
  (_, i) => {
    const y = new Date().getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  }
);

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "—";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getBudgetStatusColor(status: string): string {
  switch (status) {
    case "Draft":    return "bg-muted text-muted-foreground border-border";
    case "Pending":  return "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400";
    case "Approved": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";
    case "Rejected": return "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400";
    default:         return "bg-muted text-muted-foreground border-border";
  }
}
