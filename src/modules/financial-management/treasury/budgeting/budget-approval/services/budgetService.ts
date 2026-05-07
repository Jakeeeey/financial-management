import type { Division, Department } from "../../budget-creation/types";

// The approval module reuses the backend endpoints from budget-creation for dropdown lookups
const API_BASE = "/api/fm/treasury/budgeting/budget-creation";
const API_DIVISIONS = `${API_BASE}/division`;
const API_DEPT_DIV = `${API_BASE}/department_per_division`;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const budgetApprovalService = {
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
        dept_div_id: item.id,
    }));
  },
};
