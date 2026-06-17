import { fetchProxy } from "./apiService";
import { HistoryNode } from "../constants";

const BUDGET_CREATION_PROXY_BASE_URL = "/api/fm/treasury/budgeting/budget-creation";

export interface UpstreamBudgetItem {
  id?: string | number;
  budget_no?: string;
  status?: string;
  year?: string | number;
  month?: string;
  amount?: string | number;
  entry_type?: string;
  remarks?: string;
  division_id?: { division_id?: string | number; division_name?: string } | string | number;
  department_id?: { department_id?: string | number; department_name?: string } | string | number;
  coa_id?: { coa_id?: string | number; gl_code?: string; account_title?: string } | string | number;
}

export interface HistoryDivisionLookup {
  id: string;
  name: string;
}

export interface HistoryDepartmentLookup {
  id: string;
  name: string;
  deptDivId: string;
}

export interface HistoryCoaLookup {
  id: string;
  label: string;
}

interface DivisionProxyItem {
  division_id?: string | number;
  division_name?: string;
}

interface DepartmentPerDivisionProxyItem {
  id?: string | number;
  department_id?: {
    department_id?: string | number;
    department_name?: string;
  } | string | number | null;
}

interface DepartmentDivisionCoaProxyItem {
  coa_id?: {
    coa_id?: string | number;
    gl_code?: string | number | null;
    account_title?: string | null;
  } | string | number | null;
}

interface AllocationDetail {
  id: string;
  name: string;
  amount: number;
  entryType: string;
  remarks?: string;
}

const getRelationId = (
  relation: string | number | { [key: string]: string | number | undefined } | null | undefined,
  key: string
) => {
  if (typeof relation === "object" && relation) {
    return String(relation[key] || "");
  }

  return relation === null || relation === undefined ? "" : String(relation);
};

export const budgetHistoryService = {
  async getDivisions(): Promise<HistoryDivisionLookup[]> {
    const query = new URLSearchParams({
      "fields": "division_id,division_name",
      "limit": "-1",
      "sort": "division_name"
    });

    const response = await fetchProxy<{ data: DivisionProxyItem[] }>(
      `${BUDGET_CREATION_PROXY_BASE_URL}/division?${query.toString()}`
    );

    return (response?.data || [])
      .map(item => ({
        id: String(item.division_id || ""),
        name: item.division_name || "Unnamed Division"
      }))
      .filter(item => item.id);
  },

  async getDepartments(divisionId: string): Promise<HistoryDepartmentLookup[]> {
    if (!divisionId) return [];

    const query = new URLSearchParams({
      "filter[division_id][_eq]": divisionId,
      "fields": "id,department_id.department_id,department_id.department_name",
      "limit": "-1"
    });

    const response = await fetchProxy<{ data: DepartmentPerDivisionProxyItem[] }>(
      `${BUDGET_CREATION_PROXY_BASE_URL}/department_per_division?${query.toString()}`
    );

    return (response?.data || [])
      .map(item => {
        const department = item.department_id;
        const departmentId = typeof department === "object" && department
          ? department.department_id
          : department;

        const departmentName = typeof department === "object" && department
          ? department.department_name
          : "Unnamed Department";

        return {
          id: String(departmentId || ""),
          name: departmentName || "Unnamed Department",
          deptDivId: String(item.id || "")
        };
      })
      .filter(item => item.id && item.deptDivId)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getCOAs(deptDivId: string): Promise<HistoryCoaLookup[]> {
    if (!deptDivId) return [];

    const query = new URLSearchParams({
      "filter[dept_div_id][_eq]": deptDivId,
      "fields": "coa_id.coa_id,coa_id.gl_code,coa_id.account_title",
      "limit": "-1"
    });

    const response = await fetchProxy<{ data: DepartmentDivisionCoaProxyItem[] }>(
      `${BUDGET_CREATION_PROXY_BASE_URL}/department_division_coa?${query.toString()}`
    );

    return (response?.data || [])
      .map(item => {
        const coa = item.coa_id;
        const coaId = typeof coa === "object" && coa ? coa.coa_id : coa;
        const glCode = typeof coa === "object" && coa?.gl_code ? String(coa.gl_code) : "";
        const accountTitle = typeof coa === "object" && coa?.account_title ? coa.account_title : "";

        return {
          id: String(coaId || ""),
          label: glCode && accountTitle ? `${glCode} - ${accountTitle}` : accountTitle || (coaId ? `COA #${coaId}` : "Unnamed COA")
        };
      })
      .filter(item => item.id)
      .sort((a, b) => a.label.localeCompare(b.label));
  },

  async getHistoricalBudgets(params: { year: string; month: string; budget_no?: string; division_id?: string; department_id?: string; coa_id?: string }): Promise<HistoryNode[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[deleted_at][_null]": "true",
      "filter[year][_eq]": params.year,
      "filter[month][_eq]": params.month,
      "limit": "-1"
    });

    if (params.division_id) {
      query.set("filter[division_id][_eq]", params.division_id);
    }

    if (params.budget_no) {
      query.set("filter[budget_no][_contains]", params.budget_no);
    }

    if (params.department_id) {
      query.set("filter[department_id][_eq]", params.department_id);
    }

    if (params.coa_id) {
      query.set("filter[coa_id][_eq]", params.coa_id);
    }

    const url = `/api/fm/treasury/budgeting/budget-history?${query.toString()}`;
    const response = await fetchProxy<{ data: UpstreamBudgetItem[] }>(url);
    const rawItems: UpstreamBudgetItem[] = response?.data || [];

    // Map to group nodes by Division -> Department -> accumulated COA
    const divisionMap = new Map<string, {
      id: string;
      name: string;
      budget: number;
      departments: Map<string, {
        id: string;
        name: string;
        budget: number;
        coas: Map<string, {
          id: string;
          name: string;
          budget: number;
          itemCount: number;
          supplementalCount: number;
          originalBudgetNos: string[];
          allocationDetails: AllocationDetail[];
        }>;
      }>;
    }>();

    for (const item of rawItems) {
      const amt = Number(item.amount || 0);
      const entryType = String(item.entry_type || "original").toLowerCase();
      const showAsChild = entryType === "supplemental" || entryType === "realignment";
      const divId = getRelationId(item.division_id, "division_id");
      const deptId = getRelationId(item.department_id, "department_id");
      const coaId = getRelationId(item.coa_id, "coa_id");
      const divName = typeof item.division_id === "object" && item.division_id?.division_name
        ? item.division_id.division_name
        : divId ? `Division #${divId}` : "General Division";
      
      const deptName = typeof item.department_id === "object" && item.department_id?.department_name
        ? item.department_id.department_name
        : deptId ? `Department #${deptId}` : "Unassigned Department";

      const glCode = typeof item.coa_id === "object" && item.coa_id?.gl_code ? item.coa_id.gl_code : "";
      const acctTitle = typeof item.coa_id === "object" && item.coa_id?.account_title ? item.coa_id.account_title : coaId ? `COA #${coaId}` : "Uncategorized";
      const coaLabel = glCode ? `${glCode} - ${acctTitle}` : acctTitle;
      const divisionKey = divId || `name:${divName}`;
      const departmentKey = deptId || `name:${deptName}`;
      const coaKey = coaId || `label:${coaLabel}`;

      // Ensure Division entry
      if (!divisionMap.has(divisionKey)) {
        divisionMap.set(divisionKey, {
          id: divisionKey,
          name: divName,
          budget: 0,
          departments: new Map()
        });
      }
      const divObj = divisionMap.get(divisionKey)!;
      divObj.budget += amt;

      // Ensure Department entry
      if (!divObj.departments.has(departmentKey)) {
        divObj.departments.set(departmentKey, {
          id: departmentKey,
          name: deptName,
          budget: 0,
          coas: new Map()
        });
      }
      const deptObj = divObj.departments.get(departmentKey)!;
      deptObj.budget += amt;

      // Accumulate COA leaf node (Original + Supplemental aggregation)
      if (!deptObj.coas.has(coaKey)) {
        const safeId = `${divisionKey}-${departmentKey}-${coaKey}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
        deptObj.coas.set(coaKey, {
          id: `coa-${safeId}`,
          name: coaLabel,
          budget: 0,
          itemCount: 0,
          supplementalCount: 0,
          originalBudgetNos: [],
          allocationDetails: []
        });
      }
      const coaObj = deptObj.coas.get(coaKey)!;
      coaObj.budget += amt;
      coaObj.itemCount += 1;
      const entryLabel = entryType.charAt(0).toUpperCase() + entryType.slice(1);
      const detailId = item.id || item.budget_no || `${coaObj.id}-${entryType}-${coaObj.itemCount}`;
      if (showAsChild) {
        coaObj.allocationDetails.push({
          id: `${coaObj.id}-${entryType}-${String(detailId).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: item.budget_no ? `${entryLabel} - ${item.budget_no}` : `${entryLabel} ${coaObj.itemCount}`,
          amount: amt,
          entryType,
          remarks: item.remarks
        });
        if (entryType === "supplemental") {
          coaObj.supplementalCount += 1;
        }
      } else if (item.budget_no) {
        coaObj.originalBudgetNos.push(item.budget_no);
      }
    }

    // Helper to generate dynamic sparkline trend based on current budget
    const generateTrend = (base: number): number[] => {
      if (base <= 0) return [0, 0, 0, 0, 0];
      return [
        Math.round(base * 0.85),
        Math.round(base * 0.92),
        Math.round(base * 0.88),
        Math.round(base * 0.96),
        base
      ];
    };

    // Construct final sorted array of HistoryNodes
    const resultNodes: HistoryNode[] = [];

    const sortedDivisions = Array.from(divisionMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    for (const div of sortedDivisions) {
      const divId = `div-${div.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const divChildren: HistoryNode[] = [];

      const sortedDepts = Array.from(div.departments.values()).sort((a, b) => a.name.localeCompare(b.name));

      for (const dept of sortedDepts) {
        const deptId = `${divId}-dept-${dept.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const coaNodes: HistoryNode[] = Array.from(dept.coas.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(coa => {
            const allocationChildren: HistoryNode[] = coa.allocationDetails.map((allocation) => ({
              id: allocation.id,
              name: allocation.name,
              budget: allocation.amount,
              trend: generateTrend(allocation.amount),
              level: 'coa' as const,
              entryType: allocation.entryType
            }));

            return {
              id: coa.id,
              name: coa.originalBudgetNos.length > 0 ? `${coa.name} (${coa.originalBudgetNos.join(", ")})` : coa.name,
              budget: coa.budget,
              trend: generateTrend(coa.budget),
              level: 'coa' as const,
              itemCount: coa.itemCount,
              supplementalCount: coa.supplementalCount,
              originalBudgetNos: coa.originalBudgetNos,
              children: allocationChildren.length > 0 ? allocationChildren : undefined
            };
          });

        divChildren.push({
          id: deptId,
          name: dept.name,
          budget: dept.budget,
          trend: generateTrend(dept.budget),
          level: 'department' as const,
          children: coaNodes
        });
      }

      resultNodes.push({
        id: divId,
        name: div.name,
        budget: div.budget,
        trend: generateTrend(div.budget),
        level: 'division' as const,
        children: divChildren
      });
    }

    return resultNodes;
  }
};
