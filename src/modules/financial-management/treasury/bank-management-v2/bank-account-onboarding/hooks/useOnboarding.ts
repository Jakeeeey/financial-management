"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EMPTY_FILTERS, ONBOARDING_PAGE_SIZE } from "../constants";
import {
  fetchOnboarding,
  registerAccount as registerAccountRequest,
  updateAccount as updateAccountRequest,
  type OnboardingApiError,
  type RegisterAccountPayload,
  type UpdateAccountPayload,
} from "../providers/onboardingApi";
import type {
  BankAccountV2,
  FormOutcome,
  OnboardingFilterState,
  OnboardingListing,
  OnboardingOptions,
} from "../types";

const EMPTY_OPTIONS: OnboardingOptions = { banks: [], accountTypes: [], cashAccounts: [] };

/** State for the Bank & Account Onboarding screen: one paged listing plus two writes. */
export function useOnboarding() {
  const [listing, setListing] = useState<OnboardingListing | null>(null);
  const [filters, setFilters] = useState<OnboardingFilterState>({ ...EMPTY_FILTERS });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const refetch = useCallback(async () => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setIsLoading(true);
    try {
      const next = await fetchOnboarding(filters, page, ONBOARDING_PAGE_SIZE);
      if (requestSeq.current !== seq) return;
      setListing(next);
      setError(null);
      // The route clamps a page past the last row; follow it so the pager stays truthful.
      if (next.page !== page) setPage(next.page);
    } catch (caught) {
      if (requestSeq.current !== seq) return;
      setError(caught instanceof Error ? caught.message : "Could not load the account register.");
    } finally {
      if (requestSeq.current === seq) setIsLoading(false);
    }
  }, [filters, page]);

  // One debounce for every trigger keeps typing in the search box from firing per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      void refetch();
    }, 250);
    return () => clearTimeout(timer);
  }, [refetch]);

  const updateFilter = useCallback(<K extends keyof OnboardingFilterState>(key: K, value: OnboardingFilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...EMPTY_FILTERS });
    setPage(1);
  }, []);

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => value !== "" && (key === "search" || value !== "ALL")).length,
    [filters],
  );

  const registerAccount = useCallback(
    async (payload: RegisterAccountPayload): Promise<FormOutcome> => {
      setIsSaving(true);
      try {
        const result = await registerAccountRequest(payload);
        await refetch();
        toast.success(result.openingBalancePosted ? "Account registered and opening balance posted" : "Account registered");
        if (result.notice) toast.info(result.notice);
        return { ok: true };
      } catch (caught) {
        const apiError = caught as OnboardingApiError;
        const message = caught instanceof Error ? caught.message : "Could not register the account.";
        if (apiError.missingMappingKeys?.length) {
          // The account exists; only the E01 posting was refused.
          await refetch();
          toast.error("Account registered, opening balance not posted", {
            description: `Accounting still has to map ${apiError.missingMappingKeys.join(", ")}.`,
          });
          return { ok: false, message, blocked: true };
        }
        toast.error(message);
        return { ok: false, message, fieldErrors: apiError.fieldErrors };
      } finally {
        setIsSaving(false);
      }
    },
    [refetch],
  );

  const saveAccount = useCallback(
    async (id: number, payload: UpdateAccountPayload): Promise<FormOutcome> => {
      setIsSaving(true);
      try {
        const result = await updateAccountRequest(id, payload);
        await refetch();
        toast.success("Account updated");
        if (result.notice) toast.info(result.notice);
        return { ok: true };
      } catch (caught) {
        const apiError = caught as OnboardingApiError;
        const message = caught instanceof Error ? caught.message : "Could not update the account.";
        toast.error(message);
        return { ok: false, message, fieldErrors: apiError.fieldErrors };
      } finally {
        setIsSaving(false);
      }
    },
    [refetch],
  );

  return {
    accounts: listing?.rows ?? ([] as BankAccountV2[]),
    total: listing?.total ?? 0,
    options: listing?.options ?? EMPTY_OPTIONS,
    notice: listing?.notice,
    filters,
    page,
    pageSize: ONBOARDING_PAGE_SIZE,
    activeFilterCount,
    isLoading,
    isSaving,
    error,
    refetch,
    updateFilter,
    resetFilters,
    setPage,
    registerAccount,
    saveAccount,
  };
}
