"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FinancialPerformanceFilterState,
  FinancialPerformanceReportCriteria,
  FinancialPerformanceResponse,
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
  appliedCriteria: FinancialPerformanceReportCriteria | null;
  hasPendingChanges: boolean;
  periodError: string | null;
  isLoading: boolean;
  isInitialLoad: boolean;
  validation: ValidationStatus;
  refresh: () => Promise<void>;
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

      let comparisonDataObj: FinancialPerformanceResponse["comparisonData"];
      if (criteria.includeComparison) {
        comparisonDataObj = await getFinancialPerformance({
          startDate: criteria.comparisonStartDate,
          endDate: criteria.comparisonEndDate,
          status: criteria.status,
          divisionName: criteria.divisionName,
          departmentName: criteria.departmentName,
          taxRate: criteria.taxRate,
        });
      }

      if (generation !== requestGenerationRef.current) return;

      setReport({
        data: { ...currentData, comparisonData: comparisonDataObj },
        criteria,
      });
      setValidation({ isValidated: true, isCertified: false, issues: [] });

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
    } catch (error) {
      if (generation !== requestGenerationRef.current) return;
      console.error("Failed to load financial performance report", error);
      toast.error(criteria.includeComparison
        ? "Failed to load the report and comparison. The last generated report is still displayed."
        : "Failed to load the report. The last generated report is still displayed.");
      setValidation({ isValidated: false, isCertified: false, issues: ["Failed to fetch data completely"] });
    } finally {
      if (generation === requestGenerationRef.current) setIsLoading(false);
    }
  }, [pathname]);

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
        appliedCriteria,
        hasPendingChanges,
        periodError,
        isLoading,
        isInitialLoad,
        validation,
        refresh,
        resetFilters,
        removeAppliedFilter,
        certifyStatement,
      }}
    >
      {children}
    </FinancialPerformanceContext.Provider>
  );
}
