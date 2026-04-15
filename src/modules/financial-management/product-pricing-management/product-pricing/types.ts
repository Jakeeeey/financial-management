// src/modules/supply-chain-management/product-pricing-management/product-pricing/types.ts

export type PriceType = {
    price_type_id: number;
    price_type_name: "A" | "B" | "C" | "D" | "E" | string;
    sort: number | null;
};

export type Category = { category_id: number; category_name: string };
export type Brand = { brand_id: number; brand_name: string };
export type Unit = {
    unit_id: number;
    unit_name: string | null;
    unit_shortcut: string | null;
    order?: number | null;
};

export type Supplier = {
    id: number;
    supplier_name: string;
    supplier_shortcut: string | null;
    isActive: number;
};

export type ProductRow = {
    product_id: number;
    parent_id?: number | null;

    product_code: string | null;
    barcode: string | null;
    product_name: string;
    isActive: number;

    product_category: number | null;
    product_brand: number | null;
    unit_of_measurement: number | null;

    // cached mirrors in products table
    price_per_unit: number | null;
    priceA: number | null;
    priceB: number | null;
    priceC: number | null;
    priceD: number | null;
    priceE: number | null;
    cost_per_unit: number | null;
};

export type ProductTierKey = "A" | "B" | "C" | "D" | "E" | "LIST";

export type PriceRow = {
    id: number;
    product_id: number;
    price_type_id: number;
    price: number | null;
    status: string;
    updated_at: string | null;
};

/**
 * ✅ New: per-variant cell used in grouped matrix rows
 * A "variant" is a concrete ProductRow (product_id) under a group,
 * keyed by its unit_of_measurement.
 */
export type VariantCell = {
    product: ProductRow;
    tiers: Record<ProductTierKey, number | null>;
};

/**
 * ✅ New: grouped matrix row
 * - group_id: parent_id ?? product_id
 * - display: representative product row used for Code/Barcode/Product/Category/Brand columns
 * - variantsByUnitId: actual editable variants keyed by unit_id (UOM)
 */
export type MatrixRow = {
    group_id: number;
    display: ProductRow;
    variantsByUnitId: Record<number, VariantCell>;
    category_name: string | null;
    brand_name: string | null;
};

export type PricingFilters = {
    q: string;

    // ✅ multi-select ids (hook uses number[])
    category_ids: number[];
    brand_ids: number[];
    unit_ids: number[];

    // ✅ multi supplier + scope (hook uses this)
    supplier_ids: number[];
    supplier_scope: "ALL" | "LINKED_ONLY";

    active_only: boolean;
    missing_tier: boolean;

    // ✅ New: UI filters for column visibility
    price_type_ids: number[];
    show_list_price: boolean;
};

export type UpsertLine = {
    product_id: number;
    price_type_id: number;
    price: number | null;
    updated_by?: number | null;
    created_by?: number | null;
    status?: string;
};
