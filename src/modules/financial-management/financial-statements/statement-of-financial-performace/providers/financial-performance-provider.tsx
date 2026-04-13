"use client";

import React, { createContext, useState, useEffect, ReactNode } from "react";
import { 
  FinancialPerformanceFilterState, 
  ValidationStatus, 
  FinancialPerformanceResponse 
} from "../types";
import { getFinancialPerformance } from "../services/financial-performance.service";
import { toast } from "sonner";

interface FinancialPerformanceContextType {
  filters: FinancialPerformanceFilterState;
  setFilters: React.Dispatch<React.SetStateAction<FinancialPerformanceFilterState>>;
  data: FinancialPerformanceResponse | null;
  isLoading: boolean;
  isInitialLoad: boolean;
  validation: ValidationStatus;
  refresh: () => Promise<void>;
  resetFilters: () => void;
  certifyStatement: (certifiedBy: string, role: string, remarks?: string) => Promise<boolean>;
}

export const FinancialPerformanceContext = createContext<FinancialPerformanceContextType | undefined>(undefined);

const initialFilters: FinancialPerformanceFilterState = {
  searchQuery: "",
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  status: "Posted",
  taxRate: 25,
  includeComparison: true,
  divisionName: "",
  departmentName: "",
  comparisonStartDate: "2025-01-01",
  comparisonEndDate: "2025-03-31",
  dataBasis: "quarterly", // Align roughly with provided start/end dates
  comparisonBasis: "quarterly",
};

export function FinancialPerformanceProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FinancialPerformanceFilterState>(initialFilters);
  const [data, setData] = useState<FinancialPerformanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if user hasn't generated yet
  
  const [validation, setValidation] = useState<ValidationStatus>({
    isValidated: true,
    isCertified: false,
    issues: [],
  });

  const loadData = async () => {
    setIsLoading(true);
    setIsInitialLoad(false);
    
    try {
      // 1. Fetch current period data
      const currentData = await getFinancialPerformance({
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: filters.status,
        divisionName: filters.divisionName,
        departmentName: filters.departmentName,
        taxRate: filters.taxRate,
      });

      // 2. Fetch comparison data concurrently if enabled
      let comparisonDataObj = undefined;
      
      if (filters.includeComparison) {
        try {
          comparisonDataObj = await getFinancialPerformance({
            startDate: filters.comparisonStartDate,
            endDate: filters.comparisonEndDate,
            status: filters.status,
            divisionName: filters.divisionName,
            departmentName: filters.departmentName,
            taxRate: filters.taxRate,
          });
        } catch (compareErr) {
          console.error("Failed to load comparison data", compareErr);
          toast.warning("Failed to load comparison data, showing current only.");
        }
      }

      const finalData: FinancialPerformanceResponse = {
        ...currentData,
        comparisonData: comparisonDataObj,
      };

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

  const refresh = () => loadData();

  const resetFilters = () => {
    setFilters(initialFilters);
    setData(null);
    setIsInitialLoad(true);
  };

  const certifyStatement = async (certifiedBy: string, role: string, remarks?: string) => {
    // Simulate certification process
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
        setFilters,
        data,
        isLoading,
        isInitialLoad,
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
