"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { EntityProfile, EntitySnapshot, RegistryCompany } from "../types";
import { WorksheetApiError, fetchWorksheet, saveProfile as requestProfileSave } from "../providers/worksheetApi";

export function useWorksheet(initialYear: number) {
  const [companies, setCompanies] = useState<RegistryCompany[]>([]);
  const [snapshot, setSnapshot] = useState<EntitySnapshot | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [year, setYear] = useState(initialYear);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumped whenever the stored profile changes, so the profile form remounts with fresh values. */
  const [profileRev, setProfileRev] = useState(0);

  const load = useCallback(
    async (nextCompanyId: number, nextYear: number, options?: { quiet?: boolean }) => {
      if (!options?.quiet) setIsLoading(true);
      setError(null);
      try {
        const payload = await fetchWorksheet(nextCompanyId, nextYear);
        setCompanies(payload.companies);
        setSnapshot(payload.snapshot);
        setProfileRev((current) => current + 1);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not build the worksheet.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchWorksheet(1, initialYear);
        if (cancelled) return;
        setCompanies(payload.companies);
        setSnapshot(payload.snapshot);
        setCompanyId(payload.snapshot.company.companyId);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not build the worksheet.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialYear]);

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
      if (companyId) void load(companyId, nextYear);
    },
    [companyId, load],
  );

  /** Saves the whole profile once. Returns false so the form can keep the draft on failure. */
  const saveProfile = useCallback(
    async (next: EntityProfile): Promise<boolean> => {
      setIsSaving(true);
      try {
        const saved = await requestProfileSave(next);
        setSnapshot((current) => (current ? { ...current, profile: saved } : current));
        setProfileRev((current) => current + 1);
        toast.success("Tax profile saved.");
        await load(saved.companyId, saved.taxYear, { quiet: true });
        return true;
      } catch (caught) {
        const message = caught instanceof WorksheetApiError || caught instanceof Error ? caught.message : null;
        toast.error(message || "The profile could not be saved.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [load],
  );

  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        value: String(company.companyId),
        label: `${company.code} · ${company.name}`,
        // The endpoint URL used to render here and swallowed the row: a host name is not a label.
        searchText: `${company.code} ${company.name} ${company.baseUrl}`,
        description: company.reachable ? undefined : `Unreachable — ${company.unreachableReason ?? "no answer"}`,
      })),
    [companies],
  );

  return {
    companies,
    companyOptions,
    companyId,
    year,
    snapshot,
    isLoading,
    isSaving,
    error,
    profileRev,
    selectCompany,
    selectYear,
    saveProfile,
    refetch: () => (companyId ? load(companyId, year) : Promise.resolve()),
  };
}
