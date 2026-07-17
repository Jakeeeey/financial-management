"use client";

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
  valueIds?: number[];
}

export interface ItemAttribute {
  id: number;
  name: string;
  display_type?: string;
}

export interface ItemAttributeValue {
  id: number;
  attribute_id: number;
  name: string;
  extra_price?: number;
}

export interface ItemTemplateLookup {
  id: number;
  name: string;
}
