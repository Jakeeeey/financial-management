import type { ConsignmentWorkspace } from "../types";

export function formatVatTreatment(value: string | null | undefined) {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "VAT") return "VAT registered";
  if (key === "NON_VAT") return "Non-VAT";
  return value || "Not provided";
}

export function parseConsignmentDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelativeTime(value: string | null | undefined) {
  const date = parseConsignmentDate(value);
  if (!date) return "Not recorded";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(date);
}

export function isOlderThanDays(value: string | null | undefined, days = 2) {
  const date = parseConsignmentDate(value);
  return Boolean(date && Date.now() - date.getTime() >= days * 86_400_000);
}

export function consigneeActionLabel(workspace: ConsignmentWorkspace, status: string, createdByMe = false) {
  if (workspace === "approvals") return createdByMe ? "View" : "Review";
  if (workspace === "my-submissions" && status === "DRAFT") return "Continue";
  return "View";
}

export function consigneeStatusLabel(status: string | null | undefined) {
  const key = String(status ?? "").trim().toUpperCase();
  if (key === "ALL") return "All statuses";
  if (key === "DRAFT") return "Drafts";
  if (key === "PENDING") return "Pending";
  if (key === "ACTIVE") return "Active";
  if (key === "REJECTED") return "Rejected";
  return key || "Unknown";
}
