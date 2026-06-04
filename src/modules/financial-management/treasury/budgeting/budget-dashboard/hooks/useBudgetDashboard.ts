"use client";

import { useState, useEffect, useCallback } from "react";
import { budgetDashboardService, DashboardMetrics } from "../services/budgetDashboardService";
import { MONTH_NAMES } from "../../budget-approval/utils";
import { toast } from "sonner";

export interface DashboardFilters {
  year: string;
  month: string;
  division_id: string;
  department_id: string;
}

export function useBudgetDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1), // Numeric string "5"
    division_id: "", // Empty for "All Divisions"
    department_id: "", // Empty for "All Departments"
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
  const [departmentComparison, setDepartmentComparison] = useState<{ name: string; allocated: number; actual: number }[]>([]);
  const [departmentCategoryMatrix, setDepartmentCategoryMatrix] = useState<{ department: string; [category: string]: number | string }[]>([]);
  const [recentDisbursements, setRecentDisbursements] = useState<Record<string, unknown>[]>([]);
  const [deptUtilization, setDeptUtilization] = useState<{ name: string; spent: number; total: number; utilization: number }[]>([]);
  const [pendingSummary, setPendingSummary] = useState<{ total: number; highPriority: number; value: number }>({
    total: 0,
    highPriority: 0,
    value: 0
  });

  const [divisions, setDivisions] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
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

  // Fetch departments when division changes
  useEffect(() => {
    if (filters.division_id) {
      budgetDashboardService.getDepartments(Number(filters.division_id))
        .then(data => {
          setDepartments(data.map((d: { department_id: string | number; department_name: string }) => ({
            id: String(d.department_id),
            name: d.department_name
          })));
        })
        .catch(() => toast.error("Failed to load departments"));
    } else {
      setDepartments([]);
      // Ensure we clear department filter if division is cleared
      setFilters(prev => prev.department_id ? ({ ...prev, department_id: "" }) : prev);
    }
  }, [filters.division_id]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // Convert numeric month to name for API
      const monthName = MONTH_NAMES[Number(filters.month) - 1];
      
      const results = await Promise.allSettled([
        budgetDashboardService.getMetrics({
          year: filters.year,
          month: monthName,
          division_id: filters.division_id || undefined,
          department_id: filters.department_id || undefined,
        }),
        budgetDashboardService.getMonthlyTrend(
          filters.year,
          filters.division_id || undefined,
          filters.department_id || undefined
        ),
        budgetDashboardService.getCategoryDistribution({
          year: filters.year,
          month: monthName,
          division_id: filters.division_id || undefined,
          department_id: filters.department_id || undefined
        }),
        budgetDashboardService.getDivisionComparison({
          year: filters.year,
          month: monthName,
          division_id: filters.division_id || undefined,
          department_id: filters.department_id || undefined,
        }),
        budgetDashboardService.getDepartmentComparison(filters.year, filters.division_id || undefined, monthName),
        budgetDashboardService.getDepartmentCategoryMatrix({
          year: filters.year,
          month: monthName,
          division_id: filters.division_id || undefined
        }),
        budgetDashboardService.getRecentDisbursements({
          year: filters.year,
          month: monthName,
          division_id: filters.division_id || undefined
        }),
        budgetDashboardService.getDepartmentUtilization({
          year: filters.year,
          month: monthName,
          division_id: filters.division_id || undefined,
          department_id: filters.department_id || undefined
        }),
        budgetDashboardService.getPendingSummary({
          year: filters.year,
          month: monthName,
          division_id: filters.division_id || undefined,
          department_id: filters.department_id || undefined,
        })
      ]);

      // Graceful degradation: only update state for successful fetches
      const getValue = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
        result.status === "fulfilled" ? result.value : fallback;

      setMetrics(getValue(results[0], { totalBudget: 0, utilized: 0, remaining: 0, utilizationRate: 0 }));
      setTrendData(getValue(results[1], []));
      setCategoryData(getValue(results[2], []));
      setDivisionComparison(getValue(results[3], []));
      setDepartmentComparison(getValue(results[4], []));
      setDepartmentCategoryMatrix(getValue(results[5], []));
      setRecentDisbursements(getValue(results[6], []));
      setDeptUtilization(getValue(results[7], []));
      setPendingSummary(getValue(results[8], { total: 0, highPriority: 0, value: 0 }));

      // Notify user if any individual fetch failed
      const failedCount = results.filter(r => r.status === "rejected").length;
      if (failedCount > 0) {
        toast.error(`${failedCount} dashboard widget(s) failed to load`);
      }
    } catch {
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
    departmentComparison,
    departmentCategoryMatrix,
    recentDisbursements,
    deptUtilization,
    pendingSummary,
    divisions,
    departments,
    loading,
    refresh: fetchMetrics,
  };
}
