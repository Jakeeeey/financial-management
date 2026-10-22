import type { AjeAuditEvent } from "../types";

export const balancedTolerance = 0.005;

export function auditEventSummary(event: AjeAuditEvent) {
  if (event.reason?.trim()) return event.reason.trim();
  const summaries: Record<string, string> = {
    Created:"Draft created",
    Edited:"Journal details updated",
    Submitted:"Submitted for approval",
    Approved:"Approved for posting",
    Rejected:"Returned for revision",
    Withdrawn:"Withdrawn from approval",
    "Revision Started":"Revision started",
    Cancelled:"Entry cancelled",
    Posted:"Posted to the General Ledger",
    "Posting Failed":"Posting failed",
    "Supporting Document Added":"Supporting document added",
    "Supporting Document Removed":"Supporting document removed",
  };
  if (summaries[event.action]) return summaries[event.action];
  const changedFields = event.changes.map(change => change.field).filter(Boolean);
  return changedFields.length ? `Updated ${changedFields.join(", ")}` : "Audit event recorded";
}

export function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function statusBadgeClass(status: string) {
  switch (status) {
    case "Posted":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    case "Approved":
      return "border-teal-500/30 bg-teal-500/10 text-teal-700";
    case "Submitted":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700";
    case "Rejected":
    case "Cancelled":
    case "Failed":
      return "border-red-500/30 bg-red-500/10 text-red-700";
    case "Draft":
    case "Voided":
    default:
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-700";
  }
}

export function todayManila() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : value + "+08:00");
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
  }).format(date) + " PHT";
}

export function formatRelativeDateTime(value: string | null | undefined) {
  if (!value) return "â€”";
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : value + "+08:00");
  if (Number.isNaN(date.getTime())) return value;
  const elapsedSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365], ["month", 60 * 60 * 24 * 30], ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24], ["hour", 60 * 60], ["minute", 60], ["second", 1],
  ];
  const [unit, secondsPerUnit] = units.find(([, seconds]) => Math.abs(elapsedSeconds) >= seconds) || units[units.length - 1];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(elapsedSeconds / secondsPerUnit), unit);
}
