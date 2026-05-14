// src/modules/supply-chain-management/product-pricing-management/product-pricing/utils/pivot.ts
import type { PriceRow, PriceType, ProductTierKey } from "../types";
import { TIERS } from "./constants";

export function buildTierIdMap(priceTypes: PriceType[]) {
    const map = new Map<ProductTierKey, number>();
    for (const t of priceTypes) {
        const name = (t.price_type_name ?? "").trim().toUpperCase();
        if (TIERS.includes(name as ProductTierKey)) {
            map.set(name as ProductTierKey, t.price_type_id);
        }
    }
    return map;
}

export function pivotPrices(
    priceTypes: PriceType[],
    rows: PriceRow[],
): Map<number, Record<ProductTierKey, number | null>> {
    const tierIdToKey = new Map<number, ProductTierKey>();
    for (const t of priceTypes) {
        const name = (t.price_type_name ?? "").trim().toUpperCase();
        if (TIERS.includes(name as ProductTierKey)) {
            tierIdToKey.set(t.price_type_id, name as ProductTierKey);
        }
    }

    const out = new Map<number, Record<ProductTierKey, number | null>>();

    for (const r of rows) {
        const key = tierIdToKey.get(r.price_type_id);
        if (!key) continue;

        if (!out.has(r.product_id)) {
            out.set(r.product_id, { A: null, B: null, C: null, D: null, E: null, LIST: null });
        }
        out.get(r.product_id)![key] = r.price;
    }

    return out;
}
