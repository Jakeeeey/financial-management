"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FinancialPerformanceFilterState,
  FinancialPerformanceReportCriteria,
  FinancialPerformanceResponse,
  FinancialPerformanceComparisonStatus,
  ValidationStatus,
} from "../types";
import { getFinancialPerformance } from "../services/financial-performance.service";
import {
  createDefaultFinancialPerformanceFilters,
  updateFinancialPerformanceFilters,
  validateFinancialPerformancePeriods,
} from "../utils/periods";
import {
  FinancialPerformanceFilterChipKey,
  hasPendingFinancialPerformanceChanges,
  parseFinancialPerformanceUrl,
  removeFinancialPerformanceFilterChip,
  serializeFinancialPerformanceReportCriteria,
  toFinancialPerformanceReportCriteria,
} from "../utils/report-state";
import { toast } from "sonner";

interface FinancialPerformanceContextType {
  filters: FinancialPerformanceFilterState;
  updateFilters: (updates: Partial<FinancialPerformanceFilterState>) => void;
  data: FinancialPerformanceResponse | null;
  reportError: string | null;
  lastUpdatedAt: Date | null;
  comparisonStatus: FinancialPerformanceComparisonStatus;
  appliedCriteria: FinancialPerformanceReportCriteria | null;
  hasPendingChanges: boolean;
  periodError: string | null;
  isLoading: boolean;
  isInitialLoad: boolean;
  validation: ValidationStatus;
  refresh: () => Promise<void>;
  retryComparison: () => Promise<void>;
  resetFilters: () => void;
  removeAppliedFilter: (key: FinancialPerformanceFilterChipKey) => void;
  certifyStatement: (certifiedBy: string, role: string, remarks?: string) => Promise<boolean>;
}

export const FinancialPerformanceContext = createContext<FinancialPerformanceContextType | undefined>(undefined);

export function FinancialPerformanceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.toString();
  const urlState = useMemo(() => parseFinancialPerformanceUrl(new URLSearchParams(urlSearch)), [urlSearch]);
  const [filters, setFilters] = useState<FinancialPerformanceFilterState>(() => urlState.filters);
  const [report, setReport] = useState<{ data: FinancialPerformanceResponse; criteria: FinancialPerformanceReportCriteria } | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [comparisonStatus, setComparisonStatus] = useState<FinancialPerformanceComparisonStatus>("not-requested");
  const data = report?.data ?? null;
  const appliedCriteria = report?.criteria ?? null;
  const hasPendingChanges = hasPendingFinancialPerformanceChanges(filters, appliedCriteria);
  const periodError = validateFinancialPerformancePeriods(filters);
  const [isLoading, setIsLoading] = useState(() => urlState.hasCriteria);
  const [isInitialLoad, setIsInitialLoad] = useState(() => !urlState.hasCriteria);
  const requestGenerationRef = useRef(0);
  const lastObservedUrlRef = useRef<string | null>(null);
  const ownNavigationRef = useRef<string | null>(null);

  const [validation, setValidation] = useState<ValidationStatus>({
    isValidated: true,
    isCertified: false,
    issues: [],
  });

  const updateFilters = (updates: Partial<FinancialPerformanceFilterState>) => {
    setFilters(current => updateFinancialPerformanceFilters(current, updates));
  };

  const loadData = useCallback(async (
    requestedFilters: FinancialPerformanceFilterState,
    urlMode: "push" | "replace" | false,
  ) => {
    const generation = ++requestGenerationRef.current;
    const normalizedFilters = updateFinancialPerformanceFilters(requestedFilters, {});
    const dateError = validateFinancialPerformancePeriods(normalizedFilters);
    if (dateError) {
      setIsLoading(false);
      setIsInitialLoad(false);
      toast.error(dateError);
      return;
    }

    const criteria = toFinancialPerformanceReportCriteria(normalizedFilters);
    setIsLoading(true);
    setIsInitialLoad(false);

    try {
      const currentData = await getFinancialPerformance({
        startDate: criteria.startDate,
        endDate: criteria.endDate,
        status: criteria.status,
        divisionName: criteria.divisionName,
        departmentName: criteria.departmentName,
        taxRate: criteria.taxRate,
      });

      if (generation !== requestGenerationRef.current) return;

      setReport({ data: currentData, criteria });
      setReportError(null);
      setLastUpdatedAt(new Date());
      setValidation({ isValidated: true, isCertified: false, issues: [] });
      setComparisonStatus(criteria.includeComparison ? "loading" : "not-requested");
      setIsLoading(false);

      if (urlMode) {
        const nextSearch = serializeFinancialPerformanceReportCriteria(criteria);
        const currentSearch = window.location.search.slice(1);
        if (currentSearch !== nextSearch) {
          ownNavigationRef.current = nextSearch;
          const nextUrl = `${pathname || window.location.pathname}?${nextSearch}${window.location.hash}`;
          if (urlMode === "push") window.history.pushState(null, "", nextUrl);
          else window.history.replaceState(null, "", nextUrl);
        }
      }

      if (criteria.includeComparison) {
        try {
          const comparisonData = await getFinancialPerformance({
            startDate: criteria.comparisonStartDate,
            endDate: criteria.comparisonEndDate,
            status: criteria.status,
            divisionName: criteria.divisionName,
            departmentName: criteria.departmentName,
            taxRate: criteria.taxRate,
          });
          if (generation !== requestGenerationRef.current) return;
          setReport({ data: { ...currentData, comparisonData }, criteria });
          setComparisonStatus("available");
        } catch (error) {
          if (generation !== requestGenerationRef.current) return;
          console.error("Failed to load financial performance comparison", error);
          setComparisonStatus("unavailable");
          toast.error("The report loaded, but comparison data is unavailable. Retry the comparison before relying on variances.");
        }
      }
    } catch (error) {
      if (generation !== requestGenerationRef.current) return;
      console.error("Failed to load financial performance report", error);
      setReportError("Failed to load the report. Please retry.");
      setValidation({ isValidated: false, isCertified: false, issues: ["Failed to fetch data completely"] });
    } finally {
      if (generation === requestGenerationRef.current) setIsLoading(false);
    }
  }, [pathname]);

  const retryComparison = useCallback(async () => {
    if (!appliedCriteria?.includeComparison) return;

    const criteria = appliedCriteria;
    const generation = ++requestGenerationRef.current;
    setComparisonStatus("loading");
    try {
      const comparisonData = await getFinancialPerformance({
        startDate: criteria.comparisonStartDate,
        endDate: criteria.comparisonEndDate,
        status: criteria.status,
        divisionName: criteria.divisionName,
        departmentName: criteria.departmentName,
        taxRate: criteria.taxRate,
      });
      if (generation !== requestGenerationRef.current) return;
      setReport(current => current ? { ...current, data: { ...current.data, comparisonData } } : current);
      setComparisonStatus("available");
      toast.success("Comparison data loaded.");
    } catch (error) {
      if (generation !== requestGenerationRef.current) return;
      console.error("Failed to retry financial performance comparison", error);
      setComparisonStatus("unavailable");
      toast.error("Comparison data is still unavailable. You can retry again.");
    }
  }, [appliedCriteria]);

  useEffect(() => {
    const previousUrl = lastObservedUrlRef.current;
    if (previousUrl === urlSearch) return;
    lastObservedUrlRef.current = urlSearch;

    if (ownNavigationRef.current === urlSearch) {
      ownNavigationRef.current = null;
      return;
    }

    if (urlState.hasCriteria) {
      setFilters(current => ({ ...urlState.filters, searchQuery: current.searchQuery }));
      void loadData(urlState.filters, "replace");
      return;
    }

    if (previousUrl !== null) {
      requestGenerationRef.current += 1;
      setFilters(current => ({ ...createDefaultFinancialPerformanceFilters(), searchQuery: current.searchQuery }));
      setReport(null);
      setReportError(null);
      setLastUpdatedAt(null);
      setComparisonStatus("not-requested");
      setIsLoading(false);
      setIsInitialLoad(true);
      setValidation({ isValidated: true, isCertified: false, issues: [] });
    }
  }, [urlSearch, urlState, loadData]);

  const refresh = () => loadData(filters, "push");

  const resetFilters = () => {
    setFilters(current => ({ ...createDefaultFinancialPerformanceFilters(), searchQuery: current.searchQuery }));
  };

  const removeAppliedFilter = (key: FinancialPerformanceFilterChipKey) => {
    setFilters(current => removeFinancialPerformanceFilterChip(current, key));
  };

  const certifyStatement = async (certifiedBy: string, role: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setValidation(prev => ({ ...prev, isCertified: true }));
    setIsLoading(false);
    toast.success("Statement certified successfully", {
      description: `Certified by ${certifiedBy} (${role})`,
    });
    return true;
  };

  return (
    <FinancialPerformanceContext.Provider
      value={{
        filters,
        updateFilters,
        data,
        reportError,
        lastUpdatedAt,
        comparisonStatus,
        appliedCriteria,
        hasPendingChanges,
        periodError,
        isLoading,
        isInitialLoad,
        validation,
        refresh,
        retryComparison,
        resetFilters,
        removeAppliedFilter,
        certifyStatement,
      }}
    >
      {children}
    </FinancialPerformanceContext.Provider>
  );
}
