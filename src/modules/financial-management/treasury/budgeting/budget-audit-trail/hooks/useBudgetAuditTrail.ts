"use client";

import { useState, useEffect } from "react";
import { auditTrailService } from "../services/auditTrailService";
import type { BudgetAuditTrail, AuditTrailFilters } from "../types";
import { toast } from "sonner";

export function useBudgetAuditTrail() {
  const [logs, setLogs] = useState<BudgetAuditTrail[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Initialize with 1 month gap
  const getInitialDates = () => {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    // Fix JS date overflow (e.g. Mar 31 -> Feb 28 instead of Mar 3)
    if (today.getMonth() === lastMonth.getMonth()) {
      lastMonth.setDate(0);
    }

    return {
      to: today.toISOString().split('T')[0],
      from: lastMonth.toISOString().split('T')[0]
    };
  };

  const initialDates = getInitialDates();

  const [filters, setFilters] = useState<AuditTrailFilters>({
    search: "",
    status: "",
    user_id: "",
    date_from: initialDates.from,
    date_to: initialDates.to,
    division_id: "",
    department_id: "",
    coa_id: "",
  });

  const updateFilter = <K extends keyof AuditTrailFilters>(key: K, value: AuditTrailFilters[K]) => {
    setFilters(prev => {
      const next: AuditTrailFilters = { ...prev, [key]: value };
      if (key === "division_id") {
        next.department_id = "";
      }
      return next;
    });
  };

  const clearFilters = () => {
    const dates = getInitialDates();
    setFilters({
      search: "",
      status: "",
      user_id: "",
      date_from: dates.from,
      date_to: dates.to,
      division_id: "",
      department_id: "",
      coa_id: "",
    });
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const data = await auditTrailService.getAuditLogs(filters);
        setLogs(data);
      } catch (err) {
        console.error("Failed to fetch audit logs:", err);
        toast.error("Failed to load audit trail history");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [filters]);

  return {
    logs,
    filters,
    updateFilter,
    clearFilters,
    loading,
    total: logs.length
  };
}
