"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchRateConfig, saveRateSetting as postSetting, saveWithholdingRate as postWithholding } from "../providers/rateConfigApi";
import type { RateConfig, RateSettingRow, WithholdingRateRow } from "../types";

export function useRateConfig(initialCompanyId: number | null) {
  const [companyId, setCompanyId] = useState<number | null>(initialCompanyId);
  const [data, setData] = useState<RateConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchRateConfig(companyId)
      .then((config) => {
        if (cancelled) return;
        setData(config);
        // The first load resolves the default company; adopt its id so later saves target it.
        if (companyId == null && config.company) setCompanyId(config.company.companyId);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "The rates could not be read.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, rev]);

  const reload = useCallback(() => setRev((value) => value + 1), []);

  const saveSetting = useCallback(
    async (row: RateSettingRow): Promise<boolean> => {
      if (companyId == null) return false;
      setIsSaving(true);
      setError(null);
      try {
        await postSetting(companyId, row);
        setRev((value) => value + 1);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The rate could not be saved.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [companyId],
  );

  const saveWithholding = useCallback(
    async (row: WithholdingRateRow): Promise<boolean> => {
      if (companyId == null) return false;
      setIsSaving(true);
      setError(null);
      try {
        await postWithholding(companyId, row);
        setRev((value) => value + 1);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The rate could not be saved.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [companyId],
  );

  return {
    companyId,
    setCompanyId,
    config: data,
    isLoading,
    isSaving,
    error,
    reload,
    saveSetting,
    saveWithholding,
  };
}
