"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft } from "lucide-react";
import { usePRDetail } from "../hooks/usePRDetail";
import { formatPHP, formatQty } from "../utils/format";

type ApprovalPrintPageProps = { id: number };

export default function ApprovalPrintPage({ id }: ApprovalPrintPageProps) {
  const router = useRouter();
  const { master, details, loading, error } = usePRDetail(id);
  const total = details.reduce((a, b) => a + Number(b.total_amount || (b.qty || 0) * (b.unit_price || 0)), 0);

  if (loading) return <Skeleton className="h-96 w-full" />;

  if (error || !master) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm text-destructive">Failed to load</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="p-8 print:p-0">
      <style>{`
        @media print {
          :root { color-scheme: light; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          #print-area { display: block; width: 100%; margin: 0; padding: 0; }
          #print-area table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
          #print-area thead { display: table-header-group; }
          #print-area tfoot { display: table-row-group; }
          #print-area tr { page-break-inside: avoid; }
          #print-area tbody { page-break-inside: auto; }
          #print-area th, #print-area td { border-top: 1px solid #ccc; padding: 6px 8px; font-size: 11px; vertical-align: top; }
          #print-area th { background: #F8FAFC !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; text-align: left; }
          #print-area .signature-section { page-break-inside: avoid; }
        }
        @page { size: A4; margin: 10mm 12mm; }
      `}</style>

      <div className="no-print mb-4 flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/fm/procurement/approval")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
      </div>

      <div id="print-area" className="max-w-4xl mx-auto p-6">
        <header className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold">PROCUREMENT</div>
            <div className="text-sm text-slate-600">Reference: {master.procurement_no}</div>
            <div className="text-sm text-slate-600">Lead Date: {master.lead_date ?? "\u2014"}</div>
            <div className="text-sm text-slate-600">Status: {master.status}{master.isApproved ? " (Approved)" : ""}</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">{master.supplier_name ?? `Supplier #${master.supplier_id ?? ""}`}</div>
            <div>{master.supplier_address}</div>
            <div>{master.supplier_email} {master.supplier_phone ? `\u00B7 ${master.supplier_phone}` : ""}</div>
            <div>TIN: {master.supplier_tin}</div>
            <div>Terms: {master.supplier_payment_terms}</div>
          </div>
        </header>
        <hr className="my-4" />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Item Template</th>
              <th className="py-2">Variant</th>
              <th className="py-2">UOM</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {details.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-2">{l.template_name ?? "\u2014"}</td>
                <td className="py-2">{l.variant_name ?? "\u2014"}</td>
                <td className="py-2">{l.uom || "\u2014"}</td>
                <td className="py-2 text-right">{formatQty(l.qty)}</td>
                <td className="py-2 text-right">{formatPHP(l.unit_price)}</td>
                <td className="py-2 text-right">{formatPHP(Number(l.total_amount || (l.qty || 0) * (l.unit_price || 0)))}</td>
              </tr>
            ))}
            {details.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No lines.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={5} className="pt-4 text-right font-semibold">Grand Total</td><td className="pt-4 text-right font-bold">{formatPHP(total)}</td></tr>
          </tfoot>
        </table>
        <div className="signature-section mt-8 grid grid-cols-2 gap-8 text-sm">
          <div><div className="font-semibold">Prepared By</div><div className="mt-12 border-t w-56"></div></div>
          <div><div className="font-semibold">Approved By</div><div className="mt-12 border-t w-56"></div></div>
        </div>
      </div>
    </div>
  );
}
