export interface PurchaseOrder {
  id: number;
  purchase_order_id?: number;
  purchase_order_no: string;
  procurement_id?: number | null;
  supplier_id?: number | { id: number; supplier_name?: string } | null;
  supplier_name?: string | null;
  encoder_id?: number | Record<string, unknown> | null;
  lead_date?: string | null;
  date?: string | null;
  total_amount?: number | string | null;
  status?: string | null;
  transaction_type?: string | null;
  inventory_status?: number | null;
  date_encoded?: string | null;
  date_approved?: string | null;
  date_received?: string | null;
  payment_status?: number | null;
  remark?: string | null;
}

export interface PurchaseOrderItem {
  id: number;
  po_item_id?: number;
  purchase_order_id: number;
  purchase_order_no?: string | null;
  line_no?: number | null;
  item_template_id?: number | { id: number; name?: string } | null;
  item_variant_id?: number | { id: number; name?: string } | null;
  item_name?: string | null;
  item_description?: string | null;
  qty?: number | string | null;
  unit_price?: number | string | null;
  total_amount?: number | string | null;
  line_subtotal?: number | string | null;
  line_total?: number | string | null;
  uom?: string | null;
  tax_rate?: number | string | null;
  tax_amount?: number | string | null;
  discount_amount?: number | string | null;
  supplier_id?: number | null;
  date_added?: string | null;
}

export interface POListQuery {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function statusLabel(status?: string | null): string {
  if (!status) return "Open";
  const map: Record<string, string> = {
    pending: "Open",
    partial: "Partially Received",
    full: "Fully Received",
    cancelled: "Cancelled",
    approved: "Approved",
    draft: "Draft",
  };
  return map[status.toLowerCase()] ?? status;
}

export function statusColor(status?: string | null): string {
  if (!status) return "bg-slate-100 text-slate-700";
  const map: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700",
    partial: "bg-amber-50 text-amber-700",
    full: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
    approved: "bg-blue-50 text-blue-700",
    draft: "bg-slate-100 text-slate-700",
  };
  return map[status.toLowerCase()] ?? "bg-slate-100 text-slate-700";
}
