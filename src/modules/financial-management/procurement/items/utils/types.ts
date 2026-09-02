// Unified domain types for the procurement items module.
// Merges templates/utils/types.ts, variants/utils/types.ts, attributes/utils/types.ts.
// id / created_at are DB-generated -> readonly.

export interface ItemTemplate {
  readonly id: number;
  name: string;
  description?: string | null;
  is_active?: boolean | number | null;
  readonly created_at?: string | null;
}

export interface Unit {
  unit_id: number;
  unit_name: string;
  unit_shortcut?: string | null;
  order?: number | null;
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface ItemVariant {
  readonly id: number;
  item_tmpl_id: number;
  name: string;
  uom_id?: number | null;
  _uom_name?: string | null;
  list_price?: number | string | null;
  sku?: string | null;
  active?: boolean | number | null;
  readonly created_at?: string | null;
}

export interface CreateVariantInput {
  item_tmpl_id: number;
  name: string;
  uom_id?: number | null;
  list_price?: number | string | null;
  sku?: string | null;
  valueIds?: number[];
}

export interface ItemTemplateLookup {
  readonly id: number;
  name: string;
}

export interface ItemAttribute {
  readonly id: number;
  name: string;
  display_type?: string;
}

export interface ItemAttributeValue {
  readonly id: number;
  attribute_id: number;
  name: string;
  extra_price?: number;
  sort_order?: number;
}
