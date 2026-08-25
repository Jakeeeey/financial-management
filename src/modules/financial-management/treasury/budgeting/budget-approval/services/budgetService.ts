import { 
  type Budget, 
  type Division, 
  type Department, 
  type BudgetStatus,
  type AuditAction 
} from "../types";
import { BudgetApprovalItemSchema } from "../schemas";

interface RawApprovalAttachment {
  id?: string | number;
  budget_id?: string | number;
  directus_id?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

interface RawApprovalBudgetItem {
  id?: string | number;
  budget_no?: string;
  year?: string | number | null;
  month?: string | number | null;
  month_name?: string;
  amount?: string | number;
  status?: unknown;
  entry_type?: string;
  remarks?: string;
  coa_id?: { account_title?: string; gl_code?: string };
  department_id?: { department_name?: string; department_id?: number; id?: number };
  division_id?: { division_name?: string; division_id?: number; id?: number };
  created_at?: string;
  updated_at?: string;
}

interface RawDepartmentPerDivision {
  id?: number;
  department_id?: {
    department_id?: number;
    department_name?: string;
    id?: number;
  };
}

const API_PROXY = "/api/fm/treasury/budgeting/budget-approval";

async function fetchProxy<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error instanceof Error ? error.message : (error?.message || `HTTP ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export const budgetApprovalService = {
  /**
   * Fetch budgets for approval with optional filters
   */
  getBudgets: async (params: Record<string, unknown>): Promise<{ data: Budget[]; total: number; attachmentLoadFailed?: boolean }> => {
    const query = new URLSearchParams({
      fields: "*,coa_id.*,department_id.*,division_id.*,budget_attachments.*",
      sort: "-created_at",
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v ?? "")])
      )
    });
    
    const res = await fetchProxy<{ data: RawApprovalBudgetItem[]; meta?: { filter_count: number } }>(`${API_PROXY}?${query.toString()}`);
    const rawData = res.data || [];
    
    // Fetch attachments manually since Directus O2M relationship might not be configured
    const budgetIds = rawData.map(b => b.id).filter(Boolean);
    const attachmentsMap: Record<string, RawApprovalAttachment[]> = {};
    let attachmentLoadFailed = false;
    
    if (budgetIds.length > 0) {
      try {
        const attQuery = new URLSearchParams({
          collection: "budget_attachments",
          "filter[budget_id][_in]": budgetIds.join(","),
          fields: "id,budget_id,directus_id,file_name,file_type,file_size",
          limit: "-1"
        });
        const attRes = await fetchProxy<{ data: RawApprovalAttachment[] }>(`${API_PROXY}?${attQuery.toString()}`);
        if (attRes?.data) {
          attRes.data.forEach(att => {
            const bId = String(att.budget_id);
            if (!attachmentsMap[bId]) attachmentsMap[bId] = [];
            attachmentsMap[bId].push(att);
          });
        }
      } catch (err) {
        attachmentLoadFailed = true;
        console.error("Failed to fetch budget attachments for approval list:", err);
      }
    }
    
    const validatedData: Budget[] = [];
    rawData.forEach(item => {
      const coa = item.coa_id;
      const dept = item.department_id;
      const div = item.division_id;
      const attachments = attachmentsMap[String(item.id)] || [];

      // Robust month parsing
      let monthNum = Number(item.month);
      if (isNaN(monthNum) && typeof item.month === 'string') {
        const monthIndex = [
          "january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december"
        ].indexOf(item.month.toLowerCase());
        if (monthIndex !== -1) monthNum = monthIndex + 1;
      }

      const mapped = {
        id: item.id,
        budget_no: item.budget_no || "—",
        year: item.year ? Number(item.year) : null,
        month: isNaN(monthNum) ? null : monthNum, 
        month_name: item.month_name || (typeof item.month === 'string' && isNaN(Number(item.month)) ? item.month : "—"),
        amount: Number(item.amount || 0),
        status: item.status,
        entry_type: item.entry_type || "original",
        remarks: item.remarks,
        coa_name: coa?.account_title || "—",
        gl_code: coa?.gl_code || "—",
        division_name: div?.division_name || "—",
        department_name: dept?.department_name || "—",
        division_id: div?.division_id || div?.id,
        department_id: dept?.department_id || dept?.id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        attachments: attachments.map((att) => ({
          id: att.id,
          directus_id: att.directus_id,
          file_name: att.file_name,
          file_type: att.file_type,
          file_size: att.file_size,
        })),
      };

      const parsed = BudgetApprovalItemSchema.safeParse(mapped);
      if (parsed.success) {
        validatedData.push(parsed.data);
      } else {
        console.error("Zod Parsing Error excluding corrupted budget item:", item.id, parsed.error.format());
      }
    });

    return {
      data: validatedData,
      total: res.meta?.filter_count ?? validatedData.length,
      attachmentLoadFailed,
    };
  },

  /**
   * Update a single budget status (with audit log via proxy)
   */
  updateStatus: async (id: string | number, status: BudgetStatus, action: AuditAction, remarks?: string): Promise<void> => {
    await fetchProxy(`${API_PROXY}?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, action, remarks }),
    });
  },

  /**
   * Bulk update budget statuses (with audit logs via proxy)
   */
  bulkUpdateStatus: async (ids: (string | number)[], status: BudgetStatus, action: AuditAction, remarks?: string): Promise<void> => {
    await fetchProxy(API_PROXY, {
      method: "PATCH",
      body: JSON.stringify({
        keys: ids,
        data: { status, action, remarks }
      }),
    });
  },

  /**
   * Lookups for filters (Self-contained)
   */
  getDivisions: async (): Promise<Division[]> => {
    const res = await fetchProxy<{ data: Division[] }>(`${API_PROXY}?collection=division&fields=division_id,division_name&limit=-1`);
    const list = res.data || [];
    
    const seen = new Set();
    return list.filter(div => {
      const id = String(div.division_id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  },

  getDepartments: async (divisionId?: number): Promise<Department[]> => {
    const filter = divisionId ? `&filter[division_id][_eq]=${divisionId}` : "";
    const url = `${API_PROXY}?collection=department_per_division&fields=id,department_id.department_id,department_id.department_name${filter}&limit=-1`;
    const res = await fetchProxy<{ data: RawDepartmentPerDivision[] }>(url);
    const list = res.data || [];
    
    const mapped = list.map((item) => ({
      department_id: item.department_id?.department_id || item.department_id?.id || item.id || 0,
      department_name: item.department_id?.department_name || "—",
      parent_division: divisionId,
      dept_div_id: item.id,
    }));

    // Deduplicate by department_id to prevent key collisions
    const seen = new Set();
    return mapped.filter(dept => {
      const id = String(dept.department_id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  },
};
