"use client";

import { useState, useEffect, useCallback } from "react";
import { budgetDashboardService, DashboardMetrics } from "../services/budgetDashboardService";
import { MONTH_NAMES } from "../../budget-approval/utils";
import { toast } from "sonner";

export interface DashboardFilters {
  year: string;
  month: string;
  division_id: string;
}

export function useBudgetDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1), // Numeric string "5"
    division_id: "", // Empty for "All Divisions"
  });

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalBudget: 0,
    utilized: 0,
    remaining: 0,
    utilizationRate: 0,
  });

  const [trendData, setTrendData] = useState<{ month: string; amount: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [divisionComparison, setDivisionComparison] = useState<{ name: string; allocated: number; actual: number }[]>([]);
  const [deptUtilization, setDeptUtilization] = useState<{ name: string; spent: number; total: number; utilization: number }[]>([]);
  const [pendingSummary, setPendingSummary] = useState<{ total: number; highPriority: number; value: number }>({
    total: 0,
    highPriority: 0,
    value: 0
  });

  const [divisions, setDivisions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch divisions once
  useEffect(() => {
    budgetDashboardService.getDivisions()
      .then(data => {
        setDivisions(data.map((d: { division_id: string | number; division_name: string }) => ({
          id: String(d.division_id),
          name: d.division_name
        })));
      })
      .catch(() => toast.error("Failed to load divisions"));
  }, []);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // Convert numeric month to name for API
      const monthName = MONTH_NAMES[Number(filters.month) - 1];
      
      const [
        metricsRes, 
        trendRes, 
        categoryRes,
        divCompRes,
        deptUtilRes,
        pendingRes
      ] = await Promise.all([
        budgetDashboardService.getMetrics({
          year: filters.year,
          month: monthName,
          division_id: filters.division_id || undefined,
        }),
        budgetDashboardService.getMonthlyTrend(
          filters.year,
          filters.division_id || undefined
        ),
        budgetDashboardService.getCategoryDistribution({
          year: filters.year,
          division_id: filters.division_id || undefined
        }),
        budgetDashboardService.getDivisionComparison(filters.year),
        budgetDashboardService.getDepartmentUtilization({
          year: filters.year,
          division_id: filters.division_id || undefined
        }),
        budgetDashboardService.getPendingSummary()
      ]);

      setMetrics(metricsRes);
      setTrendData(trendRes);
      setCategoryData(categoryRes);
      setDivisionComparison(divCompRes);
      setDeptUtilization(deptUtilRes);
      setPendingSummary(pendingRes);
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
      toast.error("Failed to refresh dashboard metrics");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return {
    filters,
    updateFilter,
    metrics,
    trendData,
    categoryData,
    divisionComparison,
    deptUtilization,
    pendingSummary,
    divisions,
    loading,
    refresh: fetchMetrics,
  };
}
