"use client";

import * as React from "react";
import type { PriceType } from "../types";
import * as api from "../providers/pricingApi";

export function usePriceTypes() {
    const [loading, setLoading] = React.useState(true);
    const [priceTypes, setPriceTypes] = React.useState<PriceType[]>([]);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                setLoading(true);
                setError(null);

                const res = await api.getPriceTypes();
                if (!mounted) return;

                setPriceTypes(res.data ?? []);
            } catch (error: unknown) {
                if (!mounted) return;

                setError(error instanceof Error ? error.message : "Failed to load price types");
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    return { loading, error, priceTypes };
}