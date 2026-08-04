import type { ReactNode } from "react";
import type { ExpectedCollectionRecord } from "../types";
import { formatReportDate } from "../utils/date";
import { HighlightedText } from "./HighlightedText";

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

function InvoiceDetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-muted/10 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </section>
  );
}

export function InvoiceDetails({
  record,
  invoiceQuery = "",
  customerQuery = "",
}: {
  record: ExpectedCollectionRecord;
  invoiceQuery?: string;
  customerQuery?: string;
}) {
  const postedStatus = record.isPosted === null ? "N/A" : record.isPosted > 0 ? "Posted" : "Unposted";

  return (
    <div className="rounded-md border bg-background p-4">
      <h3 className="text-sm font-semibold">Invoice details</h3>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <DetailSection title="Invoice identity">
          <InvoiceDetailField label="Invoice ID" value={String(record.invoiceId || "N/A")} />
          <InvoiceDetailField label="Invoice number" value={<HighlightedText value={record.invoiceNo} query={invoiceQuery} />} />
          <InvoiceDetailField label="Order ID" value={formatText(record.orderId)} />
          <InvoiceDetailField label="Customer" value={<HighlightedText value={record.customerName} query={customerQuery} />} />
          <InvoiceDetailField label="Customer code" value={<HighlightedText value={record.customerCode} query={customerQuery} />} />
        </DetailSection>

        <DetailSection title="Ownership and status">
          <InvoiceDetailField label="Salesman" value={record.salesman || "Unassigned Salesman"} />
          <InvoiceDetailField label="Division" value={record.division || "Unassigned Division"} />
          <InvoiceDetailField label="Branch" value={formatText(record.branch)} />
          <InvoiceDetailField label="Posting status" value={postedStatus} />
          <InvoiceDetailField label="Days overdue" value={record.daysOverdue === null ? "N/A" : String(record.daysOverdue)} />
        </DetailSection>

        <DetailSection title="Dates">
          <InvoiceDetailField label="Invoice date" value={formatReportDate(record.invoiceDate)} />
          <InvoiceDetailField label="Due date" value={formatReportDate(record.dueDate)} />
        </DetailSection>

        <DetailSection title="Financial breakdown">
          <InvoiceDetailField label="Gross amount" value={formatNullablePeso(record.grossAmount)} />
          <InvoiceDetailField label="Discount amount" value={formatNullablePeso(record.discountAmount)} />
          <InvoiceDetailField label="Return amount" value={formatNullablePeso(record.returnAmount)} />
          <InvoiceDetailField label="Net receivable" value={formatNullablePeso(record.netReceivable)} />
          <InvoiceDetailField label="Unfulfilled amount" value={formatNullablePeso(record.unfulfilledAmount)} />
          <InvoiceDetailField label="Applied credit memos" value={formatNullablePeso(record.appliedCreditMemos)} />
          <InvoiceDetailField label="Applied debit memos" value={formatNullablePeso(record.appliedDebitMemos)} />
          <InvoiceDetailField label="Total paid" value={formatNullablePeso(record.totalPaid)} />
          <InvoiceDetailField label="Outstanding balance" value={formatPeso(record.outstandingBalance)} />
        </DetailSection>
      </div>
    </div>
  );
}
