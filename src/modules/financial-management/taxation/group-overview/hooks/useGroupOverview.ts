"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { GroupOverviewData } from "../types";
import { fetchGroupOverview } from "../providers/groupOverviewApi";

/** One group-wide read per year. Year changes and refreshes are the only reload triggers. */
export function useGroupOverview(initialYear: number) {
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<GroupOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const payload = await fetchGroupOverview(year);
        if (!cancelled) setData(payload);
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "Could not load the group overview.";
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, reloadKey]);

  const refetch = useCallback(() => setReloadKey((key) => key + 1), []);

  /** A new year invalidates the payload; a refresh of the same year does not, so rows stay put. */
  const changeYear = useCallback((nextYear: number) => {
    setData(null);
    setYear(nextYear);
  }, []);

  return { data, isLoading, error, year, setYear: changeYear, refetch };
}
