import { statusLabel, statusColor } from "./types";

const MAX_LEN = 9;

function truncateDisplay(s: string): string {
  if (s.length <= MAX_LEN) return s;
  const decimalIdx = s.indexOf(".");
  if (decimalIdx === -1) return s.slice(0, MAX_LEN) + "\u2026";
  const intPart = s.slice(0, decimalIdx);
  const maxInt = MAX_LEN - 3;
  if (intPart.length > maxInt) return s.slice(0, maxInt) + "\u2026";
  return s.slice(0, MAX_LEN) + "\u2026";
}

export function formatCurrency(val: number | string | null | undefined): string {
  const n = Number(val ?? 0);
  return truncateDisplay(new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n));
}

export function toNum(val: unknown): number {
  return Number(val ?? 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "2-digit",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export { statusLabel, statusColor };
