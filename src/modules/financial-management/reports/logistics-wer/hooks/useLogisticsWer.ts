"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchLogisticsWerDetails,
  fetchLogisticsWerReport,
} from "../services/logisticsWerApi";
import type {
  LogisticsWerDispatchPlan,
  LogisticsWerDispatchPlanDetail,
  LogisticsWerReportPage,
} from "../types";
import { currentManilaWeek, isValidDateRange, shiftWeek, type DateRange } from "../utils/date";
import { LOGISTICS_WER_VISIBLE_STATUSES } from "../utils/status";

const PAGE_SIZE = 25;

export const LOGISTICS_WER_STATUS_OPTIONS = [
  { value: "ALL", label: "All eligible statuses" },
  ...LOGISTICS_WER_VISIBLE_STATUSES.map((value) => ({ value, label: value })),
];

export function useLogisticsWer() {
  const searchParams = useSearchParams();
  const initialRange = currentManilaWeek();
  const [range, setRange] = useState<DateRange>(initialRange);
  const [draftRange, setDraftRange] = useState<DateRange>(initialRange);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [report, setReport] = useState<LogisticsWerReportPage | null>(null);
  const [detail, setDetail] = useState<LogisticsWerDispatchPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const requestId = useRef(0);
  const lastPlan = useRef<LogisticsWerDispatchPlan | null>(null);
  const deepLinkedPlanId = useRef<number | null>(null);

  // Deep link (?planId=) from the approval module: open that plan's details.
  useEffect(() => {
    const rawPlanId = searchParams.get("planId");
    const planId = rawPlanId !== null ? Number(rawPlanId) : 0;
    if (!Number.isSafeInteger(planId) || planId <= 0 || deepLinkedPlanId.current === planId) return;
    deepLinkedPlanId.current = planId;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    fetchLogisticsWerDetails(planId)
      .then((loaded) => setDetail(loaded))
      .catch((requestError) => {
        setDetailError(requestError instanceof Error ? requestError.message : "Unable to load dispatch plan details.");
      })
      .finally(() => setDetailLoading(false));
  }, [searchParams]);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLogisticsWerReport({
        ...range,
        search,
        status,
        page,
        size: PAGE_SIZE,
      });
      if (currentRequest === requestId.current) setReport(response);
    } catch (requestError) {
      if (currentRequest === requestId.current) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load Logistics WER.");
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page, range, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = useCallback(() => {
    if (!isValidDateRange(draftRange)) {
      setError("Enter a valid date range with the start date on or before the end date.");
      return;
    }
    setError(null);
    setRange(draftRange);
    setSearch(draftSearch.trim());
    setPage(0);
  }, [draftRange, draftSearch]);

  const navigateWeek = useCallback((amount: number) => {
    const nextRange = shiftWeek(range, amount);
    setRange(nextRange);
    setDraftRange(nextRange);
    setPage(0);
  }, [range]);

  const resetToCurrentWeek = useCallback(() => {
    const nextRange = currentManilaWeek();
    setRange(nextRange);
    setDraftRange(nextRange);
    setPage(0);
  }, []);

  const changeStatus = useCallback((nextStatus: string) => {
    setStatus(nextStatus);
    setPage(0);
  }, []);

  const openDetails = useCallback(async (plan: LogisticsWerDispatchPlan) => {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    lastPlan.current = plan;
    try {
      setDetail(await fetchLogisticsWerDetails(plan.id, plan));
    } catch (requestError) {
      if (lastPlan.current?.id === plan.id) {
        setDetailError(requestError instanceof Error ? requestError.message : "Unable to load dispatch plan details.");
      }
    } finally {
      if ((lastPlan.current?.id ?? detail?.plan.id) === plan.id) setDetailLoading(false);
    }
  }, [detail]);

  const refreshDetails = useCallback(async () => {
    // Deep-linked sheets (?planId=) never went through openDetails, so
    // lastPlan is unset there — fall back to the currently open detail.
    const plan = lastPlan.current ?? detail?.plan ?? null;
    if (!plan) return;
    setDetailError(null);
    setDetailLoading(true);
    try {
      setDetail(await fetchLogisticsWerDetails(plan.id, plan));
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : "Unable to load dispatch plan details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  return {
    report,
    range,
    draftRange,
    setDraftRange,
    draftSearch,
    setDraftSearch,
    status,
    loading,
    detail,
    detailLoading,
    error,
    detailError,
    page,
    applyFilters,
    navigateWeek,
    resetToCurrentWeek,
    changeStatus,
    openDetails,
    closeDetails: () => {
      lastPlan.current = null;
      setDetail(null);
    },
    refreshDetails,
    retry: load,
    setPage,
  };
}
