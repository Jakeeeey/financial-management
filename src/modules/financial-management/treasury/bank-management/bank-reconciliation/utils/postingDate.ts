export function postingDateError(value: string, bounds: { min: string | null; max: string | null }, badInput = false): string {
  if (!bounds.min || !bounds.max) return "Set the period end date in Reconcile first.";
  const effective = value || bounds.max;
  const parsed = new Date(`${effective}T00:00:00Z`);
  if (badInput || !/^\d{4}-\d{2}-\d{2}$/.test(effective) || effective < "1000-01-01" || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== effective) return "Enter a valid posting date in yyyy-mm-dd format.";
  if (effective < bounds.min || effective > bounds.max) return `Posting date must be between ${bounds.min} and ${bounds.max}.`;
  return "";
}
