export type ProcurementRequest = {
  id: number;
  procurement_no: string;
  supplier_id: number | null;
  lead_date: string | null;
  total_amount: number | null;
  created_at: string | null;
  updated_at: string | null;
  encoder_id: number | null;
  department_id: number | null;
  po_no: number | null;
  isApproved: number | null;
  approved_by: number | null;
  approved_date: string | null;
  transaction_type: string | null;
  status: string | null;
  supplier_name?: string | null;
  supplier_email?: string | null;
  supplier_phone?: string | null;
  supplier_address?: string | null;
  supplier_tin?: string | null;
  supplier_payment_terms?: string | null;
  encoder_name?: string | null;
  department_name?: string | null;
};

export type ProcurementDetail = {
  id: number;
  procurement_id: number;
  item_variant_id: number | null;
  item_template_id: number | null;
  qty: number;
  unit_price: number;
  total_amount: number;
  date_added: string | null;
  supplier: number | null;
  link: string | null;
  created_at: string | null;
  updated_at: string | null;
  uom: string | null;
  template_name: string | null;
  variant_name: string | null;
  supplier_name?: string | null;
};

export type Supplier = {
  id: number;
  supplier_name: string;
  email_address: string | null;
  phone_number: string | null;
  address: string | null;
  supplier_type: string | null;
  tin_number: string | null;
  payment_terms: string | null;
};

export type ItemTemplate = {
  id: number;
  name: string;
  uom: string | null;
  base_price: number | null;
  description: string | null;
};

export type ItemVariant = {
  id: number;
  item_tmpl_id: number;
  name: string;
  list_price: number | null;
};

export type Unit = {
  unit_id: number;
  unit_name: string;
  unit_shortcut: string | null;
  order: number | null;
};

export type PRListQuery = {
  q?: string;
  status?: string;
  supplier_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  pageSize?: number;
};

export type PRListResponse = {
  data: ProcurementRequest[];
  meta?: {
    filter_count?: number;
    total_count?: number;
  };
};

export type CreatePRInput = {
  supplier_id: number;
  lead_date: string;
  encoder_id: number;
  department_id?: number | null;
  status: string;
  items: CreatePRItemInput[];
};

export type CreatePRItemInput = {
  item_template_id: number | null;
  item_variant_id: number | null;
  uom: string | null;
  qty: number;
  unit_price: number;
  supplier?: number | null;
};

export type UpdateDetailInput = {
  qty?: number;
  unit_price?: number;
  uom?: string;
  supplier?: number | null;
  item_template_id?: number | null;
  item_variant_id?: number | null;
};

export type CreateDetailInput = {
  procurement_id: number;
  item_template_id: number | null;
  item_variant_id: number | null;
  qty: number;
  unit_price: number;
  uom?: string;
  supplier?: number | null;
};
