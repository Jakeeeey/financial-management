// src/modules/financial-management/treasury/budgeting/create-budget/services/budgetService.ts

import { Division, Department, COA } from "../types";

const API_BASE = "/api/fm/treasury/budgeting/budget-creation";
const API_DIVISIONS = `${API_BASE}/division`;
const API_DEPT_DIV = `${API_BASE}/department_per_division`;
const API_DEPT_DIV_COA = `${API_BASE}/department_division_coa`;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const budgetService = {
  getDivisions: async (): Promise<Division[]> => {
    const data = await fetchJson<any>(API_DIVISIONS);
    return Array.isArray(data) ? data : data?.data || [];
  },

  getDepartments: async (divisionId?: number): Promise<Department[]> => {
    // Filter junction by division_id and get department details
    const filter = divisionId ? `&filter[division_id][_eq]=${divisionId}` : "";
    const url = `${API_DEPT_DIV}?fields=*,department_id.*${filter}`;
    const data = await fetchJson<any>(url);
    const list = Array.isArray(data) ? data : data?.data || [];
    
    // Map junction results back to Department type
    return list.map((item: any) => ({
        ...item,
        department_id: item.department_id?.department_id || item.department_id,
        department_name: item.department_id?.department_name || item.department_name || `Dept ${item.id}`,
        dept_div_id: item.id, // We need this ID for the next level (COAs)
    }));
  },

  getCOAs: async (deptDivId?: number): Promise<COA[]> => {
    // Filter junction by dept_div_id and get COA details
    const filter = deptDivId ? `&filter[dept_div_id][_eq]=${deptDivId}` : "";
    const url = `${API_DEPT_DIV_COA}?fields=*,coa_id.*${filter}`;
    const data = await fetchJson<any>(url);
    const list = Array.isArray(data) ? data : data?.data || [];

    // Map junction results back to COA type
    return list.map((item: any) => {
        const coa = item.coa_id;
        return {
            ...item,
            coa_id: coa?.coa_id || item.coa_id,
            coa_name: coa?.account_title || coa?.coa_name || item.coa_name || `Account ${item.id}`,
            coa_code: coa?.gl_code || coa?.coa_code || item.coa_code || "",
            dept_div_coa_id: item.id, // This is the ID we actually want for the budget payload
        };
    });
  },
  
  // Submit a new budget entry
  createBudget: async (payload: any) => {
    const res = await fetch("/api/fm/treasury/budgeting/budget-creation", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to create budget" }));
        throw new Error(error.message || "Failed to create budget");
    }
    return res.json();
  }
};
