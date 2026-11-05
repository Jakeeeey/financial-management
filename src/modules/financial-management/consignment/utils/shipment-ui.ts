import type { ShipmentPreview } from "../shipment-types";

export type ShipmentBlocker = ShipmentPreview["blockers"][number];

export function formatPeso(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Unavailable";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatQuantity(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return "Unavailable";
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 6 }).format(quantity);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

export function blockerLabel(code: string) {
  return {
    INCOMPLETE_DRAFT: "Missing information",
    INSUFFICIENT_STOCK: "Insufficient warehouse stock",
    FRACTIONAL_STOCK_UNSUPPORTED: "Unsupported stock quantity",
    MISSING_COST: "Missing verified cost",
    QUANTITY_INVALID: "Invalid quantity",
    UOM_INVALID: "Invalid UOM",
    PRODUCT_MISSING: "Missing product",
    EXPOSURE_EXCEEDED: "Exposure limit exceeded",
    ACCOUNT_NOT_READY: "Inventory account not ready",
    ACCOUNT_NOT_APPROVED: "Inventory account not ready",
    WAREHOUSE_INVALID: "Warehouse not ready",
    POLICY_UNAVAILABLE: "Policy unavailable",
    STOCK_UNAVAILABLE: "Stock source unavailable",
    COMMITMENTS_UNAVAILABLE: "Pending commitments unavailable",
    JOURNAL_WRITER_UNAVAILABLE: "Journal writer unavailable",
    PERIOD_CLOSED: "Accounting period closed",
    MISSING: "Missing information",
  }[code] ?? code.replaceAll("_", " ").toLowerCase();
}

export function blockerSection(code: string) {
  if (code.includes("ACCOUNT") || code.includes("POLICY") || code.includes("WAREHOUSE")) return "Policy and accounts";
  if (code.includes("STOCK") || code.includes("COMMITMENT") || code.includes("PRODUCT") || code.includes("UOM")) return "Stock and products";
  if (code.includes("EXPOSURE")) return "Exposure";
  if (code.includes("JOURNAL") || code.includes("PERIOD")) return "Posting";
  return "Shipment details";
}

export function fieldLabel(field: string) {
  if (field === "agreementId") return "Active agreement";
  if (field === "documentDate") return "Document date";
  if (field === "deliveryReference") return "Delivery reference";
  if (field === "stockSource" || field === "valuation") return "Stock and valuation";
  if (field === "exposure") return "Agreement exposure";
  if (field === "warehouseBranchId" || field === "warehouseAccountId" || field === "consignmentAccountId") return "Policy settings";
  const line = field.match(/^lines\.(\d+)(?:\.(.+))?$/);
  if (line) {
    const number = Number(line[1]) === 0 ? 1 : Number(line[1]);
    const part = line[2];
    if (part === "quantity") return `Line ${number} quantity`;
    if (part === "productId") return `Line ${number} product`;
    return `Line ${number}`;
  }
  return field.replaceAll(".", " ");
}

export function fieldElementId(field: string) {
  if (field === "deliveryReference") return "shipment-delivery-reference";
  if (field === "documentDate") return "shipment-document-date";
  if (field === "agreementId") return "shipment-agreement";
  const line = field.match(/^lines\.(\d+)(?:\.(.+))?$/);
  if (line) {
    const number = Math.max(1, Number(line[1]));
    return line[2] === "productId" ? `shipment-line-${number - 1}` : `shipment-line-${number - 1}-quantity`;
  }
  return null;
}

export function groupBlockers(blockers: ShipmentBlocker[]) {
  const groups = new Map<string, ShipmentBlocker[]>();
  for (const blocker of blockers) {
    const section = blockerSection(blocker.code);
    groups.set(section, [...(groups.get(section) ?? []), blocker]);
  }
  return [...groups.entries()].map(([title, items]) => ({ title, items }));
}

export function focusShipmentField(field: string) {
  const direct = fieldElementId(field);
  if (direct) {
    document.getElementById(direct)?.focus();
    document.getElementById(direct)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const line = field.match(/^lines\.(\d+)/);
  if (!line) return;
  const number = Number(line[1]);
  const candidates = [`shipment-line-${number - 1}-quantity`, `shipment-line-${number}-quantity`, `shipment-line-${Math.max(0, number - 1)}`];
  for (const candidate of candidates) {
    const element = document.getElementById(candidate);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }
}
