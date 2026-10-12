"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CollectionSummaryReportDto, PouchReportDto } from "@/modules/financial-management/treasury/collection/report/hooks/useCollectionReport";
import type { RawTreasuryPouch } from "@/modules/financial-management/treasury/collection/settlement/utils/settlement-printable-data";

export type RelatedMemoReference = {
    type: "collection" | "invoice";
    id: number;
    number: string;
    customerName?: string;
};

interface InvoiceDetailsPayload {
    ok: boolean;
    message?: string;
    header?: {
        invoice_id: number;
        order_id?: string;
        customer_code?: string;
        invoice_no?: string;
        invoice_date?: string;
        dispatch_date?: string;
        due_date?: string;
        transaction_status?: string;
        payment_status?: string;
        total_amount?: number;
        gross_amount?: number;
        discount_amount?: number;
        net_amount?: number;
        salesman_id?: { salesman_name?: string };
        branch_id?: { branch_name?: string };
    };
    items?: Array<{
        detail_id: number;
        unit_price: number;
        quantity: number;
        discount_amount?: number;
        total_amount: number;
        product_id?: { product_id?: number; product_name?: string };
        unit_details?: { unit_name?: string; unit_shortcut?: string } | null;
        discount_type_details?: { discount_type?: string; total_percent?: number | string } | null;
    }>;
    payments?: Array<{
        id: number;
        reference_no?: string;
        paid_amount: number;
        date_paid: string;
        coa_id?: { account_title?: string } | null;
        bank_id?: { bank_name?: string } | null;
    }>;
    memos?: Array<{
        id: number;
        amount: number;
        date_applied: string;
        memo_id?: { memo_number?: string; type?: number; status?: string } | null;
    }>;
    returns?: Array<{
        id: number;
        amount: number;
        created_at?: string;
        return_no?: { return_number?: string; return_date?: string; remarks?: string; status?: string } | null;
    }>;
}

type InvoiceDetails = Required<Pick<InvoiceDetailsPayload, "header">> & InvoiceDetailsPayload;

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(url, { cache: "no-store", signal });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
        const message = payload?.message || payload?.detail || payload?.error;
        throw new Error(typeof message === "string" ? message : `Request failed (${response.status}).`);
    }
    return payload as T;
}

const formatMoney = (value?: number | string | null) =>
    `₱${Number(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH");
};

function SummaryValue({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border bg-background p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold">{value || "—"}</p>
        </div>
    );
}

export function RelatedTransactionDetailDialog({
    reference,
    open,
    onOpenChange,
}: {
    reference: RelatedMemoReference | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
    const [collection, setCollection] = useState<PouchReportDto | null>(null);

    useEffect(() => {
        if (!open || !reference) {
            setLoading(false);
            setError(null);
            setInvoice(null);
            setCollection(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);
        setInvoice(null);
        setCollection(null);

        const load = async () => {
            try {
                if (reference.type === "invoice") {
                    const result = await getJson<InvoiceDetailsPayload>(
                        `/api/fm/accounting/accounts-receivable/invoice-details?invoiceId=${reference.id}`,
                        controller.signal,
                    );
                    if (!result.ok || !result.header) {
                        throw new Error(result.message || "Invoice details could not be loaded.");
                    }
                    setInvoice(result as InvoiceDetails);
                    return;
                }

                const rawCollection = await getJson<RawTreasuryPouch>(
                    `/api/fm/treasury/collections/${reference.id}`,
                    controller.signal,
                );
                const reportDate = rawCollection.collectionDate?.slice(0, 10);
                if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
                    throw new Error("The collection date is unavailable for this CP.");
                }

                const query = new URLSearchParams({ startDate: reportDate, endDate: reportDate });
                const report = await getJson<CollectionSummaryReportDto>(
                    `/api/fm/treasury/collections/report?${query.toString()}`,
                    controller.signal,
                );
                const matchedCollection = report.pouches?.find((pouch) => Number(pouch.id) === reference.id);
                if (!matchedCollection) {
                    throw new Error("This CP was not found in the collection report.");
                }
                setCollection(matchedCollection);
            } catch (loadError) {
                if (!controller.signal.aborted) {
                    setError(loadError instanceof Error ? loadError.message : "Unable to load transaction details.");
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void load();
        return () => controller.abort();
    }, [open, reference]);

    const title = reference?.type === "invoice" ? "Invoice Details" : "Collection Details";
    const displayedNumber = reference?.number ?? "";

    return (
        <Dialog open={open && reference !== null} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
                <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12 text-left">
                    <div className="flex flex-wrap items-center gap-3">
                        <DialogTitle>{title}</DialogTitle>
                        {reference?.type === "collection" && collection && (
                            <Badge variant={collection.isPosted ? "default" : "secondary"}>
                                {collection.isPosted ? "Posted" : "Draft"}
                            </Badge>
                        )}
                        {invoice?.header.payment_status && <Badge variant="secondary">{invoice.header.payment_status}</Badge>}
                    </div>
                    <DialogDescription>
                        {reference?.type === "invoice" ? "Invoice No." : "CP#"}: {displayedNumber}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-sm">Loading transaction details…</span>
                        </div>
                    ) : error ? (
                        <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-destructive">
                            <AlertCircle className="h-8 w-8" />
                            <p className="max-w-lg text-sm">{error}</p>
                        </div>
                    ) : invoice ? (
                        <InvoiceDetailsView details={invoice} reference={reference} />
                    ) : collection ? (
                        <CollectionDetailsView collection={collection} />
                    ) : (
                        <div className="py-12 text-center text-sm text-muted-foreground">No transaction details are available.</div>
                    )}
                </div>

                <DialogFooter className="shrink-0 border-t px-6 py-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function InvoiceDetailsView({ details, reference }: { details: InvoiceDetails; reference: RelatedMemoReference | null }) {
    const header = details.header;
    const payments = details.payments ?? [];
    const items = details.items ?? [];
    const memos = details.memos ?? [];
    const returns = details.returns ?? [];
    const paidTotal = payments.reduce((total, payment) => total + Number(payment.paid_amount || 0), 0);

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryValue label="Customer" value={reference?.customerName || header.customer_code || "—"} />
                <SummaryValue label="Branch" value={header.branch_id?.branch_name || "—"} />
                <SummaryValue label="Salesman" value={header.salesman_id?.salesman_name || "—"} />
                <SummaryValue label="Order No." value={header.order_id || "—"} />
                <SummaryValue label="Invoice Date" value={formatDate(header.invoice_date)} />
                <SummaryValue label="Dispatch Date" value={formatDate(header.dispatch_date)} />
                <SummaryValue label="Due Date" value={formatDate(header.due_date)} />
                <SummaryValue label="Transaction Status" value={header.transaction_status || "—"} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <SummaryValue label="Gross Amount" value={formatMoney(header.gross_amount)} />
                <SummaryValue label="Discount" value={formatMoney(header.discount_amount)} />
                <SummaryValue label="Net Receivable" value={formatMoney(header.net_amount)} />
                <SummaryValue label="Total Paid" value={formatMoney(paidTotal)} />
                <SummaryValue label="Total Amount" value={formatMoney(header.total_amount)} />
            </div>

            <Tabs defaultValue="items" className="min-h-[360px]">
                <TabsList className="grid h-auto w-full grid-cols-4">
                    <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
                    <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
                    <TabsTrigger value="memos">Memos ({memos.length})</TabsTrigger>
                    <TabsTrigger value="returns">Returns ({returns.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="mt-3 overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead>Product</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Qty</TableHead><TableHead>Discount</TableHead><TableHead className="text-right">Net Amount</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {items.length === 0 ? <EmptyRow colSpan={6} label="No item records found." /> : items.map((item) => (
                                <TableRow key={item.detail_id}>
                                    <TableCell>{item.product_id?.product_name || `Product #${item.product_id?.product_id ?? "—"}`}</TableCell>
                                    <TableCell>{item.unit_details?.unit_shortcut || item.unit_details?.unit_name || "—"}</TableCell>
                                    <TableCell className="text-right">{formatMoney(item.unit_price)}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell>{item.discount_type_details?.discount_type || "—"}{item.discount_amount ? ` · ${formatMoney(item.discount_amount)}` : ""}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatMoney(item.total_amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="payments" className="mt-3 overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead>Date Paid</TableHead><TableHead>Account / Bank</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {payments.length === 0 ? <EmptyRow colSpan={4} label="No payment history found." /> : payments.map((payment) => (
                                <TableRow key={payment.id}>
                                    <TableCell>{formatDate(payment.date_paid)}</TableCell>
                                    <TableCell>{payment.coa_id?.account_title || payment.bank_id?.bank_name || "—"}</TableCell>
                                    <TableCell>{payment.reference_no || "—"}</TableCell>
                                    <TableCell className="text-right">{formatMoney(payment.paid_amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="memos" className="mt-3 overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Date Applied</TableHead><TableHead>Memo No.</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {memos.length === 0 ? <EmptyRow colSpan={4} label="No memo records found." /> : memos.map((memo) => (
                                <TableRow key={memo.id}>
                                    <TableCell>{formatDate(memo.date_applied)}</TableCell>
                                    <TableCell>{memo.memo_id?.memo_number || "—"}</TableCell>
                                    <TableCell>{memo.memo_id?.status || "—"}</TableCell>
                                    <TableCell className="text-right">{formatMoney(memo.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="returns" className="mt-3 overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Date Linked</TableHead><TableHead>Return No.</TableHead><TableHead>Remarks</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {returns.length === 0 ? <EmptyRow colSpan={5} label="No sales return history found." /> : returns.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{formatDate(item.created_at || item.return_no?.return_date)}</TableCell>
                                    <TableCell>{item.return_no?.return_number || "—"}</TableCell>
                                    <TableCell>{item.return_no?.remarks || "—"}</TableCell>
                                    <TableCell>{item.return_no?.status || "—"}</TableCell>
                                    <TableCell className="text-right">{formatMoney(item.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function CollectionDetailsView({ collection }: { collection: PouchReportDto }) {
    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryValue label="Collection Date" value={formatDate(collection.date)} />
                <SummaryValue label="Status" value={collection.isPosted ? "Posted" : "Draft"} />
                <SummaryValue label="Total Cash" value={formatMoney(collection.totalCash)} />
                <SummaryValue label="Total Checks" value={formatMoney(collection.totalCheck)} />
                <SummaryValue label="Invoice Net Total" value={formatMoney(collection.invoiceNetTotal)} />
                <SummaryValue label="Overage" value={formatMoney(collection.overage)} />
                <SummaryValue label="Shortage" value={formatMoney(collection.shortage)} />
                <SummaryValue label="Settled Invoices" value={String(collection.totalInvoices)} />
            </div>

            <Tabs defaultValue="assets" className="min-h-[360px]">
                <TabsList className="grid h-auto w-full grid-cols-3">
                    <TabsTrigger value="assets">Assets ({collection.checks?.length ?? 0})</TabsTrigger>
                    <TabsTrigger value="settled">Settled ({collection.invoices?.length ?? 0})</TabsTrigger>
                    <TabsTrigger value="variances">Variances ({collection.variances?.length ?? 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="assets" className="mt-3 overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead>Bank</TableHead><TableHead>Check No.</TableHead><TableHead>Check Date</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {(collection.checks ?? []).length === 0 ? <EmptyRow colSpan={5} label="No checks recorded." /> : collection.checks.map((check, index) => (
                                <TableRow key={`${check.checkNo}-${index}`}>
                                    <TableCell>{check.bankName}</TableCell><TableCell>{check.checkNo}</TableCell><TableCell>{formatDate(check.chequeDate)}</TableCell>
                                    <TableCell>{check.customerName || "—"}</TableCell><TableCell className="text-right">{formatMoney(check.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="settled" className="mt-3 overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead>Invoice / Customer</TableHead><TableHead className="text-right">Invoice Total</TableHead>
                            <TableHead className="text-right">Amount Applied</TableHead><TableHead className="text-right">Remaining Balance</TableHead>
                            <TableHead className="text-right">Memos</TableHead><TableHead className="text-right">Returns</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {(collection.invoices ?? []).length === 0 ? <EmptyRow colSpan={6} label="No settled invoices recorded." /> : collection.invoices.map((item, index) => (
                                <TableRow key={`${item.invoiceNo}-${index}`}>
                                    <TableCell><span className="block font-medium">{item.invoiceNo}</span><span className="text-xs text-muted-foreground">{item.customerName}</span></TableCell>
                                    <TableCell className="text-right">{formatMoney(item.actualInvoiceTotal)}</TableCell>
                                    <TableCell className="text-right">{formatMoney(item.grossAmount)}</TableCell>
                                    <TableCell className="text-right">{formatMoney(item.remainingBalance)}</TableCell>
                                    <TableCell className="text-right">{formatMoney(item.memoAmount)}</TableCell>
                                    <TableCell className="text-right">{formatMoney(item.returnAmount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="variances" className="mt-3 overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead>Type</TableHead><TableHead>Customer</TableHead><TableHead>Invoice No.</TableHead>
                            <TableHead>Account / Remarks</TableHead><TableHead className="text-right">Amount</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {(collection.variances ?? []).length === 0 ? <EmptyRow colSpan={5} label="No variances recorded." /> : collection.variances.map((item, index) => (
                                <TableRow key={`${item.type}-${item.invoiceNo}-${index}`}>
                                    <TableCell>{item.type}</TableCell><TableCell>{item.customerName || "—"}</TableCell><TableCell>{item.invoiceNo || "—"}</TableCell>
                                    <TableCell><span className="block font-medium">{item.accountTitle}</span><span className="text-xs text-muted-foreground">{item.remarks}</span></TableCell>
                                    <TableCell className="text-right">{formatMoney(item.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
    return <TableRow><TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">{label}</TableCell></TableRow>;
}
