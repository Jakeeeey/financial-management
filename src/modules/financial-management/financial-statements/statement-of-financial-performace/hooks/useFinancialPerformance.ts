"use client";

import { useContext } from "react";
import { FinancialPerformanceContext } from "../providers/financial-performance-provider";

export function useFinancialPerformance() {
  const context = useContext(FinancialPerformanceContext);
  if (context === undefined) {
    throw new Error("useFinancialPerformance must be used within a FinancialPerformanceProvider");
  }
  return context;
}
