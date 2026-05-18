import { fetchProxy } from "./apiService";
import { HistoryNode } from "../constants";

export interface UpstreamBudgetItem {
  status?: string;
  year?: string | number;
  month?: string;
  amount?: string | number;
  division_id?: { division_name?: string } | string;
  department_id?: { department_name?: string } | string;
  coa_id?: { gl_code?: string; account_title?: string } | string;
}

export const budgetHistoryService = {
  async getHistoricalBudgets(params: { year: string; month: string }): Promise<HistoryNode[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[year][_eq]": params.year,
      "filter[month][_eq]": params.month,
      "limit": "-1"
    });

    const url = `/api/fm/treasury/budgeting/budget-history?${query.toString()}`;
    const response = await fetchProxy<{ data: UpstreamBudgetItem[] }>(url);
    const rawItems: UpstreamBudgetItem[] = response?.data || [];

    // Map to group nodes by Division -> Department -> accumulated COA
    const divisionMap = new Map<string, {
      name: string;
      budget: number;
      departments: Map<string, {
        name: string;
        budget: number;
        coas: Map<string, { id: string; name: string; budget: number; itemCount: number }>;
      }>;
    }>();

    for (const item of rawItems) {
      const amt = Number(item.amount || 0);
      const divName = typeof item.division_id === "object" && item.division_id?.division_name
        ? item.division_id.division_name
        : "General Division";
      
      const deptName = typeof item.department_id === "object" && item.department_id?.department_name
        ? item.department_id.department_name
        : "Unassigned Department";

      const glCode = typeof item.coa_id === "object" && item.coa_id?.gl_code ? item.coa_id.gl_code : "";
      const acctTitle = typeof item.coa_id === "object" && item.coa_id?.account_title ? item.coa_id.account_title : "Uncategorized";
      const coaLabel = glCode ? `${glCode} - ${acctTitle}` : acctTitle;

      // Ensure Division entry
      if (!divisionMap.has(divName)) {
        divisionMap.set(divName, {
          name: divName,
          budget: 0,
          departments: new Map()
        });
      }
      const divObj = divisionMap.get(divName)!;
      divObj.budget += amt;

      // Ensure Department entry
      if (!divObj.departments.has(deptName)) {
        divObj.departments.set(deptName, {
          name: deptName,
          budget: 0,
          coas: new Map()
        });
      }
      const deptObj = divObj.departments.get(deptName)!;
      deptObj.budget += amt;

      // Accumulate COA leaf node (Original + Supplemental aggregation)
      if (!deptObj.coas.has(coaLabel)) {
        const safeId = `${divName}-${deptName}-${glCode}-${acctTitle}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
        deptObj.coas.set(coaLabel, {
          id: `coa-${safeId}-${Math.random().toString(36).substring(2, 7)}`,
          name: coaLabel,
          budget: 0,
          itemCount: 0
        });
      }
      const coaObj = deptObj.coas.get(coaLabel)!;
      coaObj.budget += amt;
      coaObj.itemCount += 1;
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
          .map(coa => ({
            id: coa.id,
            name: coa.name,
            budget: coa.budget,
            trend: generateTrend(coa.budget),
            level: 'coa' as const,
            itemCount: coa.itemCount
          }));

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
