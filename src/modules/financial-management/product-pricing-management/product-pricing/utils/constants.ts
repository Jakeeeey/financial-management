import type { ProductTierKey } from "../types";

export const TIERS: ProductTierKey[] = ["LIST", "A", "B", "C", "D", "E"];

export function isTierName(v: string): v is ProductTierKey {
    return TIERS.includes(v as ProductTierKey);
}
