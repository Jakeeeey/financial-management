// src/modules/user-expense-limit/utils/index.ts

export const API_BASE = "/api/fm/treasury/budgeting/user-expense-limit";

export function formatPeso(amount: number | string): string {
  return `₱${Number(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getFullName(user: { user_fname?: string | null; user_lname?: string | null; user_email?: string | null }): string {
  const name = [user.user_fname, user.user_lname].filter(Boolean).join(" ");
  return name || user.user_email || "—";
}