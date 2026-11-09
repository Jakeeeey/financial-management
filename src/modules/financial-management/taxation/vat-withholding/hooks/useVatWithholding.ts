"use client";

import { useCallback, useEffect, useState } from "react";

import type { VatWithholdingData } from "../types";
import { fetchVatWithholding } from "../providers/vatWithholdingApi";

/**
 * One company-year of the VAT & withholding desk.
 *
 * Data stays on screen while a new company or year loads, so switching keys does not
 * flash skeletons; the last good payload is preferable to an empty table.
 */
export function useVatWithholding(companyId: number | null, year: number) {
  const [data, setData] = useState<VatWithholdingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const payload = await fetchVatWithholding(companyId, year, controller.signal);
        if (cancelled) return;
        setData(payload);
      } catch (caught) {
        if (cancelled || controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [companyId, year, nonce]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  return { data, isLoading, error, refetch };
}
