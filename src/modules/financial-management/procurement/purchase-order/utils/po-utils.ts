import { statusLabel, statusColor } from "./types";

export function formatCurrency(val: number | string | null | undefined): string {
  const n = Number(val ?? 0);
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
}

export function toNum(val: unknown): number {
  return Number(val ?? 0);
}

export { statusLabel, statusColor };
