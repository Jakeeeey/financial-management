import type { PriceChangeRequestRow, CostChangeRequestRow } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export function productLabel(r: PriceChangeRequestRow | CostChangeRequestRow) {
    const product = r.product_id;

    if (isRecord(product)) {
        const code =
            typeof product.product_code === "string" ? product.product_code : String(product.product_code ?? "");
        const name =
            typeof product.product_name === "string" ? product.product_name : String(product.product_name ?? "");

        return [code, name].filter(Boolean).join(" - ");
    }

    return `Product #${r.product_id}`;
}

export function priceTypeLabel(r: PriceChangeRequestRow) {
    const priceType = r.price_type_id;

    if (isRecord(priceType)) {
        const priceTypeName =
            typeof priceType.price_type_name === "string"
                ? priceType.price_type_name
                : String(priceType.price_type_name ?? "");

        const priceTypeId =
            typeof priceType.price_type_id === "number" || typeof priceType.price_type_id === "string"
                ? String(priceType.price_type_id)
                : "";

        return priceTypeName || `#${priceTypeId}`;
    }

    return `#${r.price_type_id}`;
}