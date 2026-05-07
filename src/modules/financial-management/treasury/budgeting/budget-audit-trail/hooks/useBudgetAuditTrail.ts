"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { BudgetAuditTrail, AuditTrailFilters } from "../types";

const MOCK_AUDIT_DATA: BudgetAuditTrail[] = [
  {
    id: "log-1",
    budget_id: "b-101",
    action: "Created",
    performed_by: { id: "u-1", name: "Juan Dela Cruz", role: "Budget Creator" },
    performed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    new_status: "Draft",
    new_amount: 5000,
    coa_name: "Office Supplies",
    gl_code: "5001",
    department_name: "HR",
    division_name: "Corporate",
    month: 5,
    year: 2026,
    remarks: "Initial budget request for Q2 supplies"
  },
  {
    id: "log-2",
    budget_id: "b-101",
    action: "Submitted",
    performed_by: { id: "u-1", name: "Juan Dela Cruz", role: "Budget Creator" },
    performed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.5).toISOString(),
    previous_status: "Draft",
    new_status: "Pending",
    new_amount: 5000,
    coa_name: "Office Supplies",
    gl_code: "5001",
    department_name: "HR",
    division_name: "Corporate",
    month: 5,
    year: 2026
  },
  {
    id: "log-3",
    budget_id: "b-101",
    action: "Rejected",
    performed_by: { id: "u-99", name: "Admin Maria", role: "Treasury Manager" },
    performed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    previous_status: "Pending",
    new_status: "Rejected",
    new_amount: 5000,
    coa_name: "Office Supplies",
    gl_code: "5001",
    department_name: "HR",
    division_name: "Corporate",
    month: 5,
    year: 2026,
    remarks: "Please reduce amount. ₱5k is too high for this month."
  },
  {
    id: "log-4",
    budget_id: "b-101",
    action: "Resubmitted",
    performed_by: { id: "u-1", name: "Juan Dela Cruz", role: "Budget Creator" },
    performed_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    previous_status: "Rejected",
    new_status: "Pending",
    previous_amount: 5000,
    new_amount: 3500,
    coa_name: "Office Supplies",
    gl_code: "5001",
    department_name: "HR",
    division_name: "Corporate",
    month: 5,
    year: 2026,
    remarks: "Reduced as requested."
  },
  {
    id: "log-5",
    budget_id: "b-101",
    action: "Approved",
    performed_by: { id: "u-99", name: "Admin Maria", role: "Treasury Manager" },
    performed_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(), // 1 hour ago
    previous_status: "Pending",
    new_status: "Approved",
    new_amount: 3500,
    coa_name: "Office Supplies",
    gl_code: "5001",
    department_name: "HR",
    division_name: "Corporate",
    month: 5,
    year: 2026,
    remarks: "Approved for May 2026."
  }
];

export function useBudgetAuditTrail() {
  const [filters, setFilters] = useState<AuditTrailFilters>({
    search: "",
    action: "",
    user_id: "",
    date_from: "",
    date_to: "",
    division_id: "",
    department_id: "",
  });

  const [loading, setLoading] = useState(false);
  const [allLogs, setAllLogs] = useState<BudgetAuditTrail[]>(MOCK_AUDIT_DATA);

  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      if (filters.action && log.action !== filters.action) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        return (
          log.coa_name.toLowerCase().includes(s) ||
          log.gl_code.toLowerCase().includes(s) ||
          log.performed_by.name.toLowerCase().includes(s) ||
          log.remarks?.toLowerCase().includes(s)
        );
      }
      return true;
    }).sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
  }, [allLogs, filters]);

  const updateFilter = (key: keyof AuditTrailFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      action: "",
      user_id: "",
      date_from: "",
      date_to: "",
      division_id: "",
      department_id: "",
    });
  };

  return {
    logs: filteredLogs,
    filters,
    updateFilter,
    clearFilters,
    loading,
    total: filteredLogs.length
  };
}
