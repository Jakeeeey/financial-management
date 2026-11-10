"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchIntercompany, IntercompanyApiError } from "../providers/intercompanyApi";
import type { IntercompanyPayload, RegistryCompany } from "../types";
import type { ComboboxOption } from "../components/OptionCombobox";

/**
 * One company's intercompany ledger for one year.
 *
 * The route answers for a whole year at once, so this hook owns the current company and year
 * and reloads the payload when either changes. The first request seeds the registry's first
 * company, as the entity worksheet does; if that company is gone from the registry the
 * payload's own company list decides the fallback.
 */

const SEED_COMPANY_ID = 1;

export interface IntercompanyHook {
  data: IntercompanyPayload | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  companyId: number;
  year: number;
  selectedCompany: RegistryCompany | null;
  companyOptions: ComboboxOption[];
  selectCompany: (companyId: number) => void;
  selectYear: (year: number) => void;
}

export function useIntercompany(initialYear: number): IntercompanyHook {
  const [data, setData] = useState<IntercompanyPayload | null>(null);
  const [companyId, setCompanyId] = useState<number>(SEED_COMPANY_ID);
  const [year, setYear] = useState<number>(initialYear);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextCompanyId: number | null, nextYear: number, fresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchIntercompany(nextCompanyId, nextYear, fresh);
      setData(payload);
    } catch (caught) {
      setError(caught instanceof IntercompanyApiError ? caught.message : "The intercompany ledger could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(SEED_COMPANY_ID, initialYear);
  }, [load, initialYear]);

  // The seed is a guess about the registry; let the payload correct it once.
  useEffect(() => {
    if (!data || data.companies.length === 0) return;
    if (data.companies.some((company) => company.companyId === companyId)) return;

    const fallback = data.companies.find((company) => company.reachable) ?? data.companies[0];
    setCompanyId(fallback.companyId);
    void load(fallback.companyId, year);
  }, [data, companyId, year, load]);

  const selectCompany = useCallback(
    (nextCompanyId: number) => {
      setCompanyId(nextCompanyId);
      void load(nextCompanyId, year);
    },
    [load, year],
  );

  const selectYear = useCallback(
    (nextYear: number) => {
      setYear(nextYear);
      void load(companyId, nextYear);
    },
    [load, companyId],
  );

  const refetch = useCallback(() => {
    void load(companyId, year, true);
  }, [load, companyId, year]);

  const companyOptions = useMemo<ComboboxOption[]>(
    () =>
      (data?.companies ?? []).map((company) => ({
        value: String(company.companyId),
        label: `${company.code} − ${company.name}`,
        searchText: `${company.code} ${company.name}`,
        description: company.reachable ? undefined : `unreachable: ${company.unreachableReason ?? "no answer"}`,
      })),
    [data],
  );

  const selectedCompany = useMemo<RegistryCompany | null>(
    () => data?.companies.find((company) => company.companyId === companyId) ?? null,
    [data, companyId],
  );

  return {
    data,
    isLoading,
    error,
    refetch,
    companyId,
    year,
    selectedCompany,
    companyOptions,
    selectCompany,
    selectYear,
  };
}


