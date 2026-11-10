"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { phtToday } from "../pht";
import type { CertificateBody, PaymentBody } from "../schemas";
import type { DeskPayload, PeriodKey, PrefillResult } from "../types";
import {
  createCertificate,
  createPayment,
  deleteCertificate,
  deletePayment,
  fetchDesk,
  lockPeriod,
  prefillCertificates,
  unlockPeriod,
  updateCertificate,
  updatePayment,
} from "../providers/payments2307Api";

const CURRENT_YEAR = Number(phtToday().slice(0, 4));

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function usePayments2307() {
  const [desk, setDesk] = useState<DeskPayload | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scopeRef = useRef<{ companyId: number | null; year: number }>({ companyId: null, year: CURRENT_YEAR });

  const load = useCallback(
    async (nextCompanyId: number | null, nextYear: number, options?: { quiet?: boolean; fresh?: boolean }) => {
    if (!options?.quiet) setIsLoading(true);
    try {
      const payload = await fetchDesk(nextCompanyId, nextYear, options?.fresh ?? false);
      setDesk(payload);
      setCompanyId(payload.companyId);
      setYear(payload.year);
      scopeRef.current = { companyId: payload.companyId, year: payload.year };
      setError(null);
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null, CURRENT_YEAR);
  }, [load]);

  const selectCompany = useCallback(
    (nextId: number) => {
      scopeRef.current = { ...scopeRef.current, companyId: nextId };
      setCompanyId(nextId);
      void load(nextId, scopeRef.current.year);
    },
    [load],
  );

  const selectYear = useCallback(
    (nextYear: number) => {
      scopeRef.current = { ...scopeRef.current, year: nextYear };
      setYear(nextYear);
      void load(scopeRef.current.companyId, nextYear);
    },
    [load],
  );

  /**
   * Every write refetches; nothing is patched into place optimistically. The refetch is part
   * of the mutation, so the toast only fires once the desk actually shows the new row.
   */
  const mutate = useCallback(
    async (action: () => Promise<unknown>, success?: string) => {
      setIsSaving(true);
      try {
        await action();
        const scope = scopeRef.current;
        await load(scope.companyId, scope.year, { quiet: true });
        if (success) toast.success(success);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The change was not saved.");
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [load],
  );

  const saveCertificate = useCallback(
    (body: CertificateBody) => mutate(() => createCertificate(body), "2307 certificate recorded."),
    [mutate],
  );

  const amendCertificate = useCallback(
    (id: number, body: CertificateBody) => mutate(() => updateCertificate(id, body), "2307 certificate updated."),
    [mutate],
  );

  const removeCertificate = useCallback(
    (id: number) => mutate(() => deleteCertificate(id), "2307 certificate deleted."),
    [mutate],
  );

  const runPrefill = useCallback(async (): Promise<PrefillResult> => {
    const { companyId: scopeId, year: scopeYear } = scopeRef.current;
    if (scopeId === null) throw new Error("Pick a company before prefilling.");
    setIsSaving(true);
    try {
      const result = await prefillCertificates(scopeId, scopeYear);
      await load(scopeId, scopeYear, { quiet: true });
      return result;
    } finally {
      setIsSaving(false);
    }
  }, [load]);

  const savePayment = useCallback((body: PaymentBody) => mutate(() => createPayment(body), "Payment recorded."), [mutate]);

  const amendPayment = useCallback(
    (id: number, body: PaymentBody) => mutate(() => updatePayment(id, body), "Payment updated."),
    [mutate],
  );

  const removePayment = useCallback((id: number) => mutate(() => deletePayment(id), "Payment deleted."), [mutate]);

  const lock = useCallback(
    async (periodKey: PeriodKey, reason: string) => {
      const { companyId: scopeId, year: scopeYear } = scopeRef.current;
      if (scopeId === null) throw new Error("Pick a company before locking a period.");
      await mutate(() => lockPeriod({ companyId: scopeId, year: scopeYear, periodKey, reason }), `${periodKey} locked.`);
    },
    [mutate],
  );

  const unlock = useCallback(
    async (periodKey: PeriodKey, reason: string) => {
      const { companyId: scopeId, year: scopeYear } = scopeRef.current;
      if (scopeId === null) throw new Error("Pick a company before unlocking a period.");
      await mutate(() => unlockPeriod(periodKey, { companyId: scopeId, year: scopeYear, reason }), `${periodKey} unlocked.`);
    },
    [mutate],
  );

  const companyOptions = useMemo(
    () =>
      (desk?.companies ?? []).map((company) => ({
        value: String(company.companyId),
        label: `${company.code} · ${company.name}`,
        searchText: `${company.code} ${company.name} ${company.tin ?? ""}`,
        description: company.tin ?? undefined,
      })),
    [desk?.companies],
  );

  return {
    companies: desk?.companies ?? [],
    companyOptions,
    companyId,
    year,
    certificates: desk?.certificates ?? [],
    payments: desk?.payments ?? [],
    locks: desk?.locks ?? [],
    expected: desk?.expected ?? [],
    notices: desk?.notices ?? [],
    isLoading,
    isSaving,
    error,
    selectCompany,
    selectYear,
    refetch: () => load(scopeRef.current.companyId, scopeRef.current.year, { fresh: true }),
    saveCertificate,
    amendCertificate,
    removeCertificate,
    runPrefill,
    savePayment,
    amendPayment,
    removePayment,
    lock,
    unlock,
  };
}


