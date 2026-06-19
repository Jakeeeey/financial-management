import type { PriceType, ProductTierKey } from "../types";

export const DEFAULT_TIERS: ProductTierKey[] = ["LIST", "A", "B", "C", "D", "E"];

export function getDynamicTiers(priceTypes: PriceType[]): ProductTierKey[] {
    const dynamicNames = priceTypes.map((pt) => pt.price_type_name).filter(Boolean);
    return ["LIST", ...dynamicNames];
}
