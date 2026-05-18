/**
 * Maps BudgetStatus to tailwind colors for consistent UI across the module.
 */
export const getBudgetStatusColor = (status: string | null | undefined) => {
  if (!status) return "bg-slate-500/10 text-slate-500 border-slate-200";
  const s = status.toLowerCase();
  switch (s) {
    case "draft":     return "bg-slate-100 text-slate-600 border-slate-200";
    case "pending":   return "bg-amber-50 text-amber-600 border-amber-200";
    case "approved":  return "bg-emerald-50 text-emerald-600 border-emerald-200";
    case "rejected":  return "bg-rose-50 text-rose-600 border-rose-200";
    case "deleted":   return "bg-gray-100 text-gray-500 border-gray-200";
    default:          return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

/**
 * Formats a number as Philippine Peso.
 */
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};
