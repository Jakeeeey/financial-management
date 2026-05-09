export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export function formatDate(value: string | null) {
  if (!value) return "—";

  try {
    const normalized = value.includes("T") ? value : `${value}T00:00:00`;
    return new Date(normalized).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

export function formatDateTime(value: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}
