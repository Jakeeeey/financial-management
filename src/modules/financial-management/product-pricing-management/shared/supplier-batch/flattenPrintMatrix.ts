import type { MatrixRow } from "../../product-pricing/types";

export type PriceTypeRef = {
    price_type_id: number;
    price_type_name?: string | null;
    sort?: number | null;
};

export type FlatSupplierProductRow = {
    product_id: number;
    product_code: string | null;
    barcode: string | null;
    product_name: string;
    group_id: number;
    parent_id: number | null;
    unit_id: number | null;
    current_list_cost: number | null;
    currentByPriceTypeId: Map<number, number | null>;
};

function priceTypeLabel(priceType: PriceTypeRef): string {
    const name = String(priceType.price_type_name ?? "").trim();
    return name || `#${priceType.price_type_id}`;
}

export function priceTypeColumnLabel(priceType: PriceTypeRef): string {
    return priceTypeLabel(priceType);
}

export function currentColumnHeader(priceType: PriceTypeRef): string {
    return `${priceTypeColumnLabel(priceType)} Current`;
}

export function proposedColumnHeader(priceType: PriceTypeRef): string {
    return `${priceTypeColumnLabel(priceType)} Proposed`;
}

export function flattenPrintMatrixRows(
    rows: MatrixRow[],
    priceTypes: PriceTypeRef[],
): FlatSupplierProductRow[] {
    const flat: FlatSupplierProductRow[] = [];

    for (const row of rows) {
        for (const variant of Object.values(row.variantsByUnitId)) {
            const product = variant.product;
            const currentByPriceTypeId = new Map<number, number | null>();

            for (const priceType of priceTypes) {
                const tierKey = String(priceType.price_type_id);
                const value = variant.tiers[tierKey];
                currentByPriceTypeId.set(
                    priceType.price_type_id,
                    value === null || value === undefined ? null : Number(value),
                );
            }

            const listTier = variant.tiers.LIST;
            const listRaw =
                listTier === null || listTier === undefined ? product.cost_per_unit : listTier;
            const currentListCost = listRaw === null || listRaw === undefined ? null : Number(listRaw);

            flat.push({
                product_id: Number(product.product_id),
                product_code: product.product_code ?? null,
                barcode: product.barcode ?? null,
                product_name: product.product_name ?? "",
                group_id: row.group_id,
                parent_id: product.parent_id ?? null,
                unit_id: product.unit_of_measurement ?? null,
                current_list_cost: Number.isFinite(currentListCost) ? currentListCost : null,
                currentByPriceTypeId,
            });
        }
    }

    flat.sort((a, b) => a.product_name.localeCompare(b.product_name));
    return flat;
}

export type FlatListCostProductRow = {
    product_id: number;
    product_code: string | null;
    barcode: string | null;
    product_name: string;
    group_id: number;
    parent_id: number | null;
    unit_id: number | null;
    current_list_cost: number | null;
};

export function flattenListCostMatrixRows(rows: MatrixRow[]): FlatListCostProductRow[] {
    const flat: FlatListCostProductRow[] = [];

    for (const row of rows) {
        for (const variant of Object.values(row.variantsByUnitId)) {
            const product = variant.product;
            const listTier = variant.tiers.LIST;
            const current =
                listTier === null || listTier === undefined
                    ? product.cost_per_unit === null || product.cost_per_unit === undefined
                        ? null
                        : Number(product.cost_per_unit)
                    : Number(listTier);

            flat.push({
                product_id: Number(product.product_id),
                product_code: product.product_code ?? null,
                barcode: product.barcode ?? null,
                product_name: product.product_name ?? "",
                group_id: row.group_id,
                parent_id: product.parent_id ?? null,
                unit_id: product.unit_of_measurement ?? null,
                current_list_cost: Number.isFinite(current) ? current : null,
            });
        }
    }

    flat.sort((a, b) => a.product_name.localeCompare(b.product_name));
    return flat;
}
