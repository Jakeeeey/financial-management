export interface ItemVariant {
  id: number;
  item_tmpl_id: number;
  name: string;
  list_price?: number | string | null;
  sku?: string | null;
  active?: boolean | number | null;
  created_at?: string | null;
  _template_name?: string;
}

export interface CreateVariantInput {
  item_tmpl_id: number;
  name: string;
  list_price?: number | string | null;
  sku?: string | null;
}
