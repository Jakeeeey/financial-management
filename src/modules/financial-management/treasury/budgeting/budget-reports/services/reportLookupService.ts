import { fetchProxy } from "./reportApiService";
import { Division, Department } from "../types";

const PROXY_LOOKUP_URL = "/api/fm/treasury/budgeting/budget-creation";

interface RawDeptPerDiv {
  id?: number;
  department_id?: {
    department_id?: number;
    id?: number;
    department_name?: string;
  };
}

export const reportLookupService = {
  async getDivisions(): Promise<Division[]> {
    const url = `${PROXY_LOOKUP_URL}/division?fields=division_id,division_name&limit=-1`;
    const result = await fetchProxy<{ data: Division[] }>(url);
    return result?.data || [];
  },

  async getDepartments(divisionId?: string | number): Promise<Department[]> {
    const filter = divisionId ? `&filter[division_id][_eq]=${divisionId}` : "";
    const url = `${PROXY_LOOKUP_URL}/department_per_division?fields=id,department_id.department_id,department_id.department_name${filter}&limit=-1`;
    
    const result = await fetchProxy<{ data: RawDeptPerDiv[] }>(url);
    const data = result?.data || [];
    
    return data.map((d) => ({
      department_id:   d.department_id?.department_id || d.department_id?.id || 0,
      department_name: d.department_id?.department_name || "-",
      dept_div_id:     d.id,
    }));
  }
};
