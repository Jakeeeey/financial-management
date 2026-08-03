import type { ExpectedCollectionRecord } from "../types";
import { formatReportDate } from "../utils/date";

const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

function formatPeso(value: number): string {
  return pesoFormatter.format(value);
}

function formatNullablePeso(value: number | null): string {
  return value === null ? "N/A" : formatPeso(value);
}

function formatText(value: string | null): string {
  return value || "N/A";
}

function InvoiceDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

export function InvoiceDetails({ record }: { record: ExpectedCollectionRecord }) {
  const postedStatus = record.isPosted === null ? "N/A" : record.isPosted > 0 ? "Posted" : "Unposted";

  return (
    <div className="rounded-md border bg-background p-4">
      <h3 className="text-sm font-semibold">Invoice details</h3>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <InvoiceDetailField label="Invoice ID" value={String(record.invoiceId || "N/A")} />
        <InvoiceDetailField label="Invoice number" value={formatText(record.invoiceNo)} />
        <InvoiceDetailField label="Order ID" value={formatText(record.orderId)} />
        <InvoiceDetailField label="Invoice date" value={formatReportDate(record.invoiceDate)} />
        <InvoiceDetailField label="Due date" value={formatReportDate(record.dueDate)} />
        <InvoiceDetailField label="Customer" value={formatText(record.customerName)} />
        <InvoiceDetailField label="Customer code" value={formatText(record.customerCode)} />
        <InvoiceDetailField label="Salesman" value={record.salesman || "Unassigned Salesman"} />
        <InvoiceDetailField label="Division" value={record.division || "Unassigned Division"} />
        <InvoiceDetailField label="Branch" value={formatText(record.branch)} />
        <InvoiceDetailField label="Posting status" value={postedStatus} />
        <InvoiceDetailField label="Days overdue" value={record.daysOverdue === null ? "N/A" : String(record.daysOverdue)} />
        <InvoiceDetailField label="Gross amount" value={formatNullablePeso(record.grossAmount)} />
        <InvoiceDetailField label="Discount amount" value={formatNullablePeso(record.discountAmount)} />
        <InvoiceDetailField label="Return amount" value={formatNullablePeso(record.returnAmount)} />
        <InvoiceDetailField label="Net receivable" value={formatNullablePeso(record.netReceivable)} />
        <InvoiceDetailField label="Unfulfilled amount" value={formatNullablePeso(record.unfulfilledAmount)} />
        <InvoiceDetailField label="Applied credit memos" value={formatNullablePeso(record.appliedCreditMemos)} />
        <InvoiceDetailField label="Applied debit memos" value={formatNullablePeso(record.appliedDebitMemos)} />
        <InvoiceDetailField label="Total paid" value={formatNullablePeso(record.totalPaid)} />
        <InvoiceDetailField label="Outstanding balance" value={formatPeso(record.outstandingBalance)} />
      </dl>
    </div>
  );
}
