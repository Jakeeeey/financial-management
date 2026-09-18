// Unified domain types for the procurement items module.
// Merges templates/utils/types.ts, variants/utils/types.ts, attributes/utils/types.ts.
// id / created_at are DB-generated -> readonly.

export interface ItemTemplate {
  readonly id: number;
  name: string;
  description?: string | null;
  is_active?: boolean | number | null;
  readonly created_at?: string | null;
  // Audit surface from todo-8 DDL (NULL until the user runs the statements): render "—" fallback.
  readonly created_by?: string | null;
  readonly updated_at?: string | null;
  readonly updated_by?: string | null;
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

// Audit + status columns from task-8 DDL (all NULL-tolerant pre-DDL: render "—").
// item_attribute: id, name, description, display_type, is_active, created_by,
//   created_at, updated_by, updated_at. Value Count = ACTIVE-ONLY value count.
export interface ItemAttribute {
  readonly id: number;
  name: string;
  description?: string | null;
  display_type?: string;
  is_active?: boolean | number | null;
  created_by?: string | null;
  readonly created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface ItemAttributeValue {
  readonly id: number;
  attribute_id: number;
  name: string;
  description?: string | null;
  extra_price?: number;
  sort_order?: number;
  is_active?: boolean | number | null;
  created_by?: string | null;
  readonly created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface CreateAttributeInput {
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface UpdateAttributeInput {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

export interface CreateAttributeValueInput {
  attribute_id: number;
  name: string;
  description?: string | null;
  extra_price?: number;
  is_active?: boolean;
}

export interface UpdateAttributeValueInput {
  name?: string;
  description?: string | null;
  extra_price?: number;
  is_active?: boolean;
}
