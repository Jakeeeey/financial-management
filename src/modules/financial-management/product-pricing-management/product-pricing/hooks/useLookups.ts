"use client";

import * as React from "react";
import type { Brand, Category, PricingFilters, Supplier, Unit } from "../types";
import * as api from "../providers/pricingApi";

function safeStr(v: unknown): string {
    const s = String(v ?? "").trim();
    if (!s || s === "undefined" || s === "null") return "";
    return s;
}

function getIds(
    filters: Partial<PricingFilters> | undefined,
    arrayKey: "category_ids" | "brand_ids" | "unit_ids" | "supplier_ids",
): string[] {
    const arr = filters?.[arrayKey];
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => String(item)).filter(Boolean);
}

export function useLookups(filters?: Partial<PricingFilters>) {
    const [loading, setLoading] = React.useState(true);
    const [categories, setCategories] = React.useState<Category[]>([]);
    const [brands, setBrands] = React.useState<Brand[]>([]);
    const [units, setUnits] = React.useState<Unit[]>([]);
    const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
    const [error, setError] = React.useState<string | null>(null);

    const supplierIds = React.useMemo(() => getIds(filters, "supplier_ids"), [filters]);
    const categoryIds = React.useMemo(() => getIds(filters, "category_ids"), [filters]);
    const brandIds = React.useMemo(() => getIds(filters, "brand_ids"), [filters]);

    const supplierIdsKey = React.useMemo(() => supplierIds.join(","), [supplierIds]);
    const categoryIdsKey = React.useMemo(() => categoryIds.join(","), [categoryIds]);
    const brandIdsKey = React.useMemo(() => brandIds.join(","), [brandIds]);

    const supplierScope: "ALL" | "LINKED_ONLY" =
        safeStr(filters?.supplier_scope) === "LINKED_ONLY" ? "LINKED_ONLY" : "ALL";

    React.useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                setLoading(true);
                setError(null);

                const res = await api.getLookups({
                    supplier_ids: supplierIdsKey,
                    supplier_scope: supplierScope,
                    category_id: categoryIds[0] ?? "",
                    brand_id: brandIds[0] ?? "",
                });

                if (!mounted) return;

                setCategories(res.data.categories ?? []);
                setBrands(res.data.brands ?? []);
                setUnits(res.data.units ?? []);
                setSuppliers(res.data.suppliers ?? []);
            } catch (error: unknown) {
                if (!mounted) return;
                setError(error instanceof Error ? error.message : "Failed to load lookups");
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [supplierIdsKey, supplierScope, categoryIds, brandIds, categoryIdsKey, brandIdsKey]);

    return { loading, error, categories, brands, units, suppliers };
}