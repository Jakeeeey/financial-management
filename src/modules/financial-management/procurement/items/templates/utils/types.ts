export interface ItemTemplate {
  id: number;
  name: string;
  uom?: string | null;
  base_price?: number | string | null;
  description?: string | null;
  is_active?: boolean | number | null;
  created_at?: string | null;
  _variant_count?: number;
}

export interface Unit {
  unit_id: number;
  unit_name: string;
  unit_shortcut?: string | null;
  order?: number | null;
}

export interface CreateTemplateInput {
  name: string;
  uom?: string | null;
  base_price?: number | string | null;
  description?: string | null;
}
