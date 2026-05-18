// src/modules/financial-management/treasury/budgeting/create-budget/utils/index.ts

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({
  value: String(i + 1),
  label: name,
}));

export const YEAR_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 10 },
  (_, i) => {
    const y = new Date().getFullYear() + i;
    return { value: String(y), label: String(y) };
  }
);

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "—";
}

export function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(Number(bytes))) return "0 B";
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function getBudgetStatusColor(status: string): string {
  switch (status) {
    case "Draft":    
      return "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400";
    case "Pending":  
      return "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 font-medium";
    case "Approved": 
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 font-medium";
    case "Rejected": 
      return "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400 font-medium";
    case "Deleted":
      return "bg-red-500/10 text-red-700 border-red-500/20 opacity-50";
    default:         
      return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  }
}
