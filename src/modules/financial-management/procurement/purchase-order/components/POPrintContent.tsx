import type { PurchaseOrder, PurchaseOrderItem } from "../utils/types";
import { formatCurrency, toNum } from "../utils/po-utils";

interface POPrintContentProps {
  po: PurchaseOrder | null;
  items: PurchaseOrderItem[];
  supplierName: string;
}

export function POPrintContent({ po, items, supplierName }: POPrintContentProps) {
  const total = items.reduce((sum, item) => sum + toNum(item.total_amount ?? item.line_total ?? toNum(item.qty) * toNum(item.unit_price)), 0);

  return (
    <div id="print-root">
      <style>{`
        @media print {
          body > :not(#print-root) { display: none !important; }
          #print-root { display: block !important; }
          #print-area { width: 190mm; margin: 0 auto; padding: 12mm; font-size: 12px; }
          #print-area table { width: 100%; border-collapse: collapse; }
          #print-area th, #print-area td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
          #print-area th { background: #f5f5f5; font-weight: 600; }
          #print-area .text-right { text-align: right; }
          #print-area .text-center { text-align: center; }
          .no-print { display: none !important; }
        }
        #print-root { display: none; }
      `}</style>
      <div id="print-area">
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>PURCHASE ORDER</h1>
          <p style={{ margin: 0, fontSize: 11, color: "#555" }}>PO No: {po?.purchase_order_no || "—"}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 11 }}>
            <strong>Supplier:</strong> {supplierName || "—"}<br />
            <strong>Date:</strong> {po?.lead_date || po?.date || "—"}
          </div>
          <div style={{ fontSize: 11, textAlign: "right" }}>
            <strong>Status:</strong> {po?.status || "—"}<br />
            <strong>Reference:</strong> {po?.procurement_id ? `PR #${po.procurement_id}` : "—"}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Item</th>
              <th style={{ width: 60 }}>UOM</th>
              <th style={{ width: 70 }} className="text-right">Qty</th>
              <th style={{ width: 100 }} className="text-right">Unit Price</th>
              <th style={{ width: 100 }} className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const resolveName = (): string => {
                if (item.item_name) return item.item_name;
                if (typeof item.item_template_id === "object" && item.item_template_id && "name" in item.item_template_id) {
                  const name = (item.item_template_id as { name?: string }).name;
                  if (typeof item.item_variant_id === "object" && item.item_variant_id && "name" in item.item_variant_id) {
                    return `${name} - ${(item.item_variant_id as { name?: string }).name}`;
                  }
                  return name ?? "Item";
                }
                return "Item";
              };
              return (
                <tr key={item.id ?? item.po_item_id ?? i}>
                  <td className="text-center">{item.line_no ?? i + 1}</td>
                  <td>{resolveName()}</td>
                  <td>{item.uom || "—"}</td>
                  <td className="text-right">{toNum(item.qty).toFixed(2)}</td>
                  <td className="text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right">{formatCurrency(item.total_amount ?? item.line_total ?? toNum(item.qty) * toNum(item.unit_price))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: "right", fontWeight: 700, padding: "8px 8px" }}>Grand Total</td>
              <td style={{ textAlign: "right", fontWeight: 700, padding: "8px 8px" }}>{formatCurrency(po?.total_amount ?? total ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
        {po?.remark && <p style={{ marginTop: 16, fontSize: 11 }}><strong>Remark:</strong> {po.remark}</p>}
      </div>
    </div>
  );
}
