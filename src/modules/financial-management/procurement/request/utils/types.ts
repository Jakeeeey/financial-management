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

export type CreatePRItemInput = {
  item_template_id: number | null;
  item_variant_id: number | null;
  uom: string | null;
  qty: number;
  unit_price: number;
};

export type CreatePRInput = {
  supplier_id: number;
  lead_date: string;
  encoder_id: number;
  department_id?: number | null;
  status: string;
  items: CreatePRItemInput[];
};
