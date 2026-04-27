import type {
  RawSalesInvoiceMonitoringRow,
  SalesInvoiceMonitoringQueryParams,
  SalesInvoiceMonitoringRow,
} from "../types";

export const PAGE_SIZE = 10;

export function getDefaultDateRange(): SalesInvoiceMonitoringQueryParams {
  const now = new Date();
  const year = now.getFullYear();
  const endDate = now.toISOString().split("T")[0];

  return {
    startDate: `${year}-01-01`,
    endDate,
  };
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toText(value: unknown, fallback = "-"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function formatAmount(value: number): string {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(value: string): string {
  if (!value || value === "-") return "-";

  const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value.split(" ")[0];
  }

  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function mapSalesInvoiceRows(
  rows: RawSalesInvoiceMonitoringRow[]
): SalesInvoiceMonitoringRow[] {
  return rows.map((row, index) => {
    const invoiceNo = toText(
      row.salesInvoiceNo ?? row.invoiceNo ?? row.invoiceNumber ?? row.invoice_number ?? row.invoiceId,
      `INV-${index + 1}`
    );
    const customerName = toText(row.customerName ?? row.customer);
    const salesman = toText(row.salesman ?? row.salesmanName);
    const amount = toNumber(row.amount ?? row.totalAmount ?? row.netReceivable);
    const deliveryDate = toText(
      row.deliveryDay ?? row.deliveryDate ?? row.calculatedDueDate ?? row.dueDate
    );
    const daysLapses = Math.max(
      0,
      Math.round(toNumber(row.daysLapses ?? row.daysLapsed ?? row.daysOverdue))
    );

    return {
      id: `${invoiceNo}-${index}`,
      invoiceNo,
      customerName,
      salesman,
      amount,
      deliveryDate,
      daysLapses,
    };
  });
}

export function getPageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];

  if (current > 3) pages.push("ellipsis");

  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
    pages.push(page);
  }

  if (current < total - 2) pages.push("ellipsis");

  pages.push(total);
  return pages;
}
