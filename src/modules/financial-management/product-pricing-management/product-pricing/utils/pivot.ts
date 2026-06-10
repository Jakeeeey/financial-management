import type { PriceRow, PriceType } from "../types";

export const LIST_TIER_KEY = "LIST";

export function sortPriceTypes(priceTypes: PriceType[]): PriceType[] {
    return [...priceTypes].sort((a, b) => {
        const aSort = Number(a.sort ?? Number.MAX_SAFE_INTEGER);
        const bSort = Number(b.sort ?? Number.MAX_SAFE_INTEGER);
        return aSort - bSort || String(a.price_type_name ?? "").localeCompare(String(b.price_type_name ?? ""));
    });
}

export function priceTierKey(priceTypeId: number): string {
    return String(priceTypeId);
}

export function isListTierKey(tier: string): boolean {
    return tier === LIST_TIER_KEY;
}

export function buildMatrixTierKeys(priceTypes: PriceType[]): string[] {
    const sorted = sortPriceTypes(priceTypes);
    return [LIST_TIER_KEY, ...sorted.map((pt) => priceTierKey(pt.price_type_id))];
}

export function emptyPivot(priceTypes: PriceType[]): Record<string, number | null> {
    const out: Record<string, number | null> = { [LIST_TIER_KEY]: null };
    for (const pt of priceTypes) {
        out[priceTierKey(pt.price_type_id)] = null;
    }
    return out;
}

export function pivotPrices(
    priceTypes: PriceType[],
    rows: PriceRow[],
): Map<number, Record<string, number | null>> {
    const validIds = new Set(priceTypes.map((pt) => pt.price_type_id));
    const out = new Map<number, Record<string, number | null>>();

    for (const r of rows) {
        if (!validIds.has(r.price_type_id)) continue;

        const tierKey = priceTierKey(r.price_type_id);
        if (!out.has(r.product_id)) {
            out.set(r.product_id, emptyPivot(priceTypes));
        }
        out.get(r.product_id)![tierKey] = r.price;
    }

    return out;
}

export function tierLabelForTierKey(tier: string, priceTypes: PriceType[]): string {
    if (isListTierKey(tier)) return "List Cost";

    const priceTypeId = Number(tier);
    if (!Number.isFinite(priceTypeId)) return tier;

    const match = priceTypes.find((pt) => pt.price_type_id === priceTypeId);
    return match?.price_type_name ?? tier;
}
