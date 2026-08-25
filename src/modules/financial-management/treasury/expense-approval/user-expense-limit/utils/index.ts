// src/modules/financial-management/treasury/budgeting/user-expense-limit/utils/index.ts

export const API_BASE = "/api/fm/treasury/expense-approval/user-expense-limit";

export const BUDGET_COAS = [
  { id: 120, name: "Meals", glCode: "1024" },
  { id: 124, name: "Parking Fee / Tool Fee", glCode: "1027" },
  { id: 161, name: "Fuel", glCode: "1031" },
  { id: 139, name: "Transportation", glCode: "1000" },
  { id: 69, name: "Others (Supplies/Repairs/etc)", glCode: "1017" }
];

export function formatPeso(amount: number | string): string {
  const n = Number(amount);
  if (isNaN(n)) return "₱0.00";
  return `₱${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getFullName(user: { user_fname?: string | null; user_lname?: string | null; user_email?: string | null }): string {
  const name = [user.user_fname, user.user_lname].filter(Boolean).join(" ");
  return name || user.user_email || "—";
}