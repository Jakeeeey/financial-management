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
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const requestId = useRef(0);
  const detailRequestId = useRef(0);
  const lastPlan = useRef<LogisticsWerDispatchPlan | null>(null);
  const deepLinkedPlanId = useRef<number | null>(null);

  // Deep link (?planId=) from the approval module: open that plan's details.
  useEffect(() => {
    const rawPlanId = searchParams.get("planId");
    const planId = rawPlanId !== null ? Number(rawPlanId) : 0;
    if (!Number.isSafeInteger(planId) || planId <= 0 || deepLinkedPlanId.current === planId) return;
    deepLinkedPlanId.current = planId;
    const currentRequest = ++detailRequestId.current;
    lastPlan.current = null;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    fetchLogisticsWerDetails(planId)
      .then((loaded) => {
        if (currentRequest === detailRequestId.current) setDetail(loaded);
      })
      .catch((requestError) => {
        if (currentRequest === detailRequestId.current) {
          setDetailError(requestError instanceof Error ? requestError.message : "Unable to load dispatch plan details.");
        }
      })
      .finally(() => {
        if (currentRequest === detailRequestId.current) setDetailLoading(false);
      });
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
    const currentRequest = ++detailRequestId.current;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    lastPlan.current = plan;
    try {
      const loaded = await fetchLogisticsWerDetails(plan.id, plan);
      if (currentRequest === detailRequestId.current) setDetail(loaded);
    } catch (requestError) {
      if (currentRequest === detailRequestId.current) {
        setDetailError(requestError instanceof Error ? requestError.message : "Unable to load dispatch plan details.");
      }
    } finally {
      if (currentRequest === detailRequestId.current) setDetailLoading(false);
    }
  }, []);

  const refreshDetails = useCallback(async () => {
    // Deep-linked sheets (?planId=) never went through openDetails, so
    // lastPlan is unset there — fall back to the currently open detail.
    const plan = lastPlan.current ?? detail?.plan ?? null;
    if (!plan) return;
    const currentRequest = ++detailRequestId.current;
    setDetailError(null);
    setDetailLoading(true);
    try {
      const loaded = await fetchLogisticsWerDetails(plan.id, plan);
      if (currentRequest === detailRequestId.current) setDetail(loaded);
    } catch (requestError) {
      if (currentRequest === detailRequestId.current) {
        setDetailError(requestError instanceof Error ? requestError.message : "Unable to load dispatch plan details.");
      }
    } finally {
      if (currentRequest === detailRequestId.current) setDetailLoading(false);
    }
  }, [detail?.plan]);

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
    detailOpen,
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
      detailRequestId.current += 1;
      lastPlan.current = null;
      setDetailOpen(false);
      setDetail(null);
      setDetailLoading(false);
      setDetailError(null);
    },
    refreshDetails,
    retry: load,
    setPage,
  };
}
