"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EMPTY_FILTERS, ONBOARDING_PAGE_SIZE } from "../constants";
import {
  fetchOnboarding,
  postOpeningBalance as postOpeningBalanceRequest,
  registerAccount as registerAccountRequest,
  saveMapping as saveMappingRequest,
  settleDueTransfers as settleDueTransfersRequest,
  updateAccount as updateAccountRequest,
  type OnboardingApiError,
  type RegisterAccountPayload,
  type SaveMappingResult,
  type SettleDueResult,
  type UpdateAccountPayload,
} from "../providers/onboardingApi";
import type {
  BankAccountV2,
  FormOutcome,
  OnboardingFilterState,
  OnboardingListing,
  OnboardingOptions,
} from "../types";

const EMPTY_OPTIONS: OnboardingOptions = { banks: [], accountTypes: [], cashAccounts: [], chartAccounts: [] };

/** State for the Bank & Account Onboarding screen: one paged listing plus two writes. */
export function useOnboarding() {
  const [listing, setListing] = useState<OnboardingListing | null>(null);
  const [filters, setFilters] = useState<OnboardingFilterState>({ ...EMPTY_FILTERS });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(ONBOARDING_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const refetch = useCallback(async () => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setIsLoading(true);
    try {
      const next = await fetchOnboarding(filters, page, pageSize);
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
  }, [filters, page, pageSize]);

  // One debounce for every trigger keeps typing in the search box from firing per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      void refetch();
    }, 250);
    return () => clearTimeout(timer);
  }, [refetch]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const updateFilter = useCallback(<K extends keyof OnboardingFilterState>(key: K, value: OnboardingFilterState[K]) => {    setFilters((current) => ({ ...current, [key]: value }));
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

  const retryOpeningBalance = useCallback(
    async (id: number) => {
      setIsSaving(true);
      try {
        const result = await postOpeningBalanceRequest(id);
        await refetch();
        if (result.posted) toast.success("Opening balance posted");
        else toast.info(result.notice ?? "Nothing was posted.");
      } catch (caught) {
        const apiError = caught as OnboardingApiError;
        if (apiError.missingMappingKeys?.length) {
          toast.error("Opening balance still blocked", {
            description: `Accounting still has to map ${apiError.missingMappingKeys.join(", ")}.`,
          });
        } else {
          toast.error(caught instanceof Error ? caught.message : "Could not post the opening balance.");
        }
      } finally {
        setIsSaving(false);
      }
    },
    [refetch],
  );

  /** Saves one posting-setup row and hands back the due-transfer count for the prompt. */
  const saveMapping = useCallback(
    async (mappingKey: string, coaId: number | null): Promise<SaveMappingResult | null> => {
      setIsSaving(true);
      try {
        const result = await saveMappingRequest(mappingKey, coaId);
        await refetch();
        return result;
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Could not save the mapping.");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch],
  );

  const settleDue = useCallback(async (): Promise<SettleDueResult | null> => {
    setIsSaving(true);
    try {
      const result = await settleDueTransfersRequest();
      await refetch();
      if (result.settled > 0) {
        toast.success(`${result.settled} ${result.settled === 1 ? "transfer" : "transfers"} settled`);
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} ${result.failed.length === 1 ? "transfer" : "transfers"} could not settle`, {
          description: result.failed[0]?.error,
        });
      }
      return result;
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not settle the due transfers.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [refetch]);

  return {
    accounts: listing?.rows ?? ([] as BankAccountV2[]),
    total: listing?.total ?? 0,
    registerTotal: listing?.registerTotal ?? 0,
    options: listing?.options ?? EMPTY_OPTIONS,
    glMapping: listing?.glMapping ?? [],
    notice: listing?.notice,
    filters,
    page,
    pageSize,
    setPageSize,
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
    retryOpeningBalance,
    saveMapping,
    settleDue,
  };
}
