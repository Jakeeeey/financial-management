"use client";

import React, { createContext, useState, useEffect, ReactNode } from "react";
import { 
  FinancialPerformanceFilterState, 
  ValidationStatus, 
  FinancialPerformanceResponse 
} from "../types";
import { MOCK_FINANCIAL_PERFORMANCE_DATA } from "../mock-data";
import { toast } from "sonner";

interface FinancialPerformanceContextType {
  filters: FinancialPerformanceFilterState;
  setFilters: React.Dispatch<React.SetStateAction<FinancialPerformanceFilterState>>;
  data: FinancialPerformanceResponse | null;
  isLoading: boolean;
  validation: ValidationStatus;
  refresh: () => Promise<void>;
  resetFilters: () => void;
  certifyStatement: (notes?: string) => Promise<boolean>;
}

export const FinancialPerformanceContext = createContext<FinancialPerformanceContextType | undefined>(undefined);

const initialFilters: FinancialPerformanceFilterState = {
  searchQuery: "",
  startDate: "2026-03-01",
  endDate: "2026-03-31",
  status: "pending",
  taxRate: 25,
  includeComparison: true,
  divisionName: "",
  departmentName: "",
  comparisonStartDate: "2025-02-01",
  comparisonEndDate: "2025-02-28",
  dataBasis: "monthly",
  comparisonBasis: "monthly",
};

export function FinancialPerformanceProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FinancialPerformanceFilterState>(initialFilters);
  const [data, setData] = useState<FinancialPerformanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [validation, setValidation] = useState<ValidationStatus>({
    isValidated: true,
    isCertified: false,
    issues: [],
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // We start with MOCK_FINANCIAL_PERFORMANCE_DATA
      let finalData = { ...MOCK_FINANCIAL_PERFORMANCE_DATA };

      // Apply comparison toggle logic from mock
      if (!filters.includeComparison) {
        finalData.comparisonSummary = undefined;
        finalData.comparisonEntries = undefined;
        finalData.comparisonRatios = undefined;
      }

      setData(finalData);
      
      setValidation({
        isValidated: true, 
        isCertified: false,
        issues: [],
      });
      
    } catch (error) {
      toast.error("Failed to load financial statement data");
      setValidation({
        isValidated: false,
        isCertified: false,
        issues: ["Failed to fetch data completely"],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const refresh = () => loadData();

  const resetFilters = () => {
    setFilters(initialFilters);
    refresh();
  };

  const certifyStatement = async (notes?: string) => {
    // Simulate certification process
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setValidation(prev => ({ ...prev, isCertified: true }));
    setIsLoading(false);
    toast.success("Statement certified successfully");
    return true;
  };

  return (
    <FinancialPerformanceContext.Provider
      value={{
        filters,
        setFilters,
        data,
        isLoading,
        validation,
        refresh,
        resetFilters,
        certifyStatement,
      }}
    >
      {children}
    </FinancialPerformanceContext.Provider>
  );
}
