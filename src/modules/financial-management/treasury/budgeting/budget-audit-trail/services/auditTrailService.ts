import type { AuditTrailFilters, Division, Department, COA } from "../types";
import { BudgetAuditTrailSchema } from "../schemas";
import type { BudgetAuditTrail } from "../types";

interface RawAuditAttachment {
  id?: string | number;
  budget_id?: string | number;
  directus_id?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

interface RawAuditUser {
  user_id?: string | number;
  id?: string | number;
  user_fname?: string;
  user_lname?: string;
  user_position?: string;
  user_avatar?: string;
}

interface RawAuditBudget {
  id?: string | number;
  amount?: string | number;
  status?: string;
  remarks?: string;
  created_at?: string;
  month?: string | number;
  year?: string | number;
  budget_no?: string;
  entry_type?: string;
  coa_id?: { account_title?: string; gl_code?: string };
  department_id?: { department_name?: string };
  division_id?: { division_name?: string };
  created_by?: RawAuditUser;
  parent_budget_id?: { id?: string | number; budget_no?: string };
  budget_attachments?: RawAuditAttachment[];
}

interface RawAuditLogItem {
  id?: string | number;
  action?: string;
  previous_status?: string | null;
  new_status?: string;
  previous_amount?: string | number | null;
  new_amount?: string | number;
  remarks?: string | null;
  performed_by?: RawAuditUser;
  performed_at?: string;
  budget_id?: RawAuditBudget;
}

interface RawDepartmentPerDiv {
  id?: number;
  department_id?: {
    department_id?: number;
    department_name?: string;
    id?: number;
  };
}

interface RawCOA {
  coa_id?: number;
  id?: number;
  account_title?: string;
  gl_code?: string;
}

const PROXY_URL = "/api/fm/treasury/budgeting/budget-audit-trail";

async function fetchProxy<T = unknown>(url: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err?.message || (err?.errors && err.errors[0] ? err.errors[0].message : null) || `Proxy Error: ${res.statusText}`;
      throw new Error(message);
    }

    if (res.status === 204) return null;
    
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return await res.json() as T;
    }
    
    return null;
  } catch (error) {
    console.error("Audit Trail Proxy Error:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export const auditTrailService = {
  async getDivisions(): Promise<Division[]> {
    const url = `${PROXY_URL}?collection=division&fields=division_id,division_name&limit=-1`;
    const result = await fetchProxy<{ data: Division[] }>(url);
    return result?.data || [];
  },

  async getDepartments(divisionId: number): Promise<Department[]> {
    if (!divisionId || isNaN(divisionId)) return [];
    
    const url = `${PROXY_URL}?collection=department_per_division&filter[division_id][_eq]=${divisionId}&fields=id,department_id.department_id,department_id.department_name&limit=-1`;
    const result = await fetchProxy<{ data: RawDepartmentPerDiv[] }>(url);
    const rawData = result?.data || [];
    
    return rawData.map((d) => ({
      department_id:   d.department_id?.department_id || d.department_id?.id || 0,
      department_name: d.department_id?.department_name || "—",
      parent_division: divisionId,
      dept_div_id:     d.id,
    }));
  },

  async getCOAs(): Promise<COA[]> {
    const url = `${PROXY_URL}?collection=chart_of_accounts&fields=coa_id,account_title,gl_code&limit=-1&sort=account_title`;
    const result = await fetchProxy<{ data: RawCOA[] }>(url);
    const rawData = result?.data || [];

    return rawData
      .map((coa) => ({
        coa_id: coa.coa_id || coa.id || 0,
        account_title: coa.account_title || "—",
        gl_code: coa.gl_code || "—",
      }))
      .filter((coa) => coa.coa_id);
  },

  async getAuditLogs(filters: AuditTrailFilters): Promise<BudgetAuditTrail[]> {
    const query = new URLSearchParams({
      collection: "budget", // Use budget collection as primary source
      fields: "*,coa_id.*,department_id.*,division_id.*,created_by.*,parent_budget_id.*,budget_attachments.*",
      limit: "-1",
      sort: "-updated_at" // Sort by latest activity
    });
    
    if (filters.status) query.append("filter[status][_eq]", filters.status);
    
    // For budgets, we filter by their update dates to capture recent activity
    if (filters.date_from) query.append("filter[updated_at][_gte]", filters.date_from);
    if (filters.date_to) {
        // Handle end-of-day by adding 23:59:59
        query.append("filter[updated_at][_lte]", `${filters.date_to}T23:59:59Z`);
    }

    if (filters.division_id && filters.division_id !== "all") query.append("filter[division_id][_eq]", filters.division_id);
    if (filters.department_id && filters.department_id !== "all") query.append("filter[department_id][_eq]", filters.department_id);
    if (filters.coa_id && filters.coa_id !== "all") query.append("filter[coa_id][_eq]", filters.coa_id);

    if (filters.search) {
      const search = filters.search.trim();
      // Enhanced search: matches budget_no OR parent budget_no Oremarks
      query.append("filter[_or][0][budget_no][_icontains]", search);
      query.append("filter[_or][1][parent_budget_id][budget_no][_icontains]", search);
      query.append("filter[_or][2][remarks][_icontains]", search);
    }

    const url = `${PROXY_URL}?${query.toString()}`;
    const result = await fetchProxy<{ data: RawAuditBudget[] }>(url);
    const rawData = result?.data || [];

    // Fetch attachments manually via bulk lookups to ensure file clips display natively
    const budgetIds = rawData.map(b => b.id).filter(Boolean);
    const attachmentsMap: Record<string, RawAuditAttachment[]> = {};

    if (budgetIds.length > 0) {
      try {
        const attQuery = new URLSearchParams({
          collection: "budget_attachments",
          "filter[budget_id][_in]": budgetIds.join(","),
          fields: "id,budget_id,directus_id,file_name,file_type,file_size",
          limit: "-1"
        });
        const attRes = await fetchProxy<{ data: RawAuditAttachment[] }>(`${PROXY_URL}?${attQuery.toString()}`);
        if (attRes?.data) {
          attRes.data.forEach(att => {
            const bId = String(att.budget_id);
            if (!attachmentsMap[bId]) attachmentsMap[bId] = [];
            attachmentsMap[bId].push(att);
          });
        }
      } catch (attErr) {
        console.error("Bulk attachment lookup failed for audit stream:", attErr);
      }
    }

    return rawData.map((budget) => {
      const coa = budget.coa_id;
      const dept = budget.department_id;
      const div = budget.division_id;
      const creator = budget.created_by;
      const parent = budget.parent_budget_id;

      // Merge native attachments array or populate from bulk mapping map
      const nativeAtts = Array.isArray(budget.budget_attachments) ? budget.budget_attachments : [];
      const bulkAtts = attachmentsMap[String(budget.id)] || [];
      // Prefer native arrays if Directus resolves them, otherwise rely on robust bulk mapping
      const finalAttachments = nativeAtts.length > 0 ? nativeAtts : bulkAtts;

      // Determine "Action" label based on current status for timeline feel
      let actionLabel = "Created";
      if (budget.status === "Approved") actionLabel = "Approved";
      else if (budget.status === "Pending") actionLabel = "Submitted";
      else if (budget.status === "Rejected") actionLabel = "Rejected";

      const mappedData = {
        id: String(budget.id),
        budget_id: String(budget.id),
        action: actionLabel,
        previous_status: null,
        new_status: budget.status || "Draft",
        previous_amount: null,
        new_amount: Number(budget.amount || 0),
        remarks: budget.remarks,
        performed_by: {
          id: creator?.user_id || creator?.id || "",
          name: creator ? `${creator.user_fname || ""} ${creator.user_lname || ""}`.trim() || "System" : "System",
          role: creator?.user_position || "User",
          avatar: creator?.user_avatar,
        },
        performed_at: budget.created_at || new Date().toISOString(),
        coa_name:        coa?.account_title || "—",
        gl_code:         coa?.gl_code || "—",
        department_name: dept?.department_name || "—",
        division_name:   div?.division_name || "—",
        month:           typeof budget.month === 'string' ? MONTH_NAMES.findIndex(m => m.toLowerCase() === (budget.month as string).toLowerCase()) + 1 : (Number(budget.month) || 0),
        year:            Number(budget.year) || 0,
        budget_no:       budget.budget_no || "—",
        entry_type:      budget.entry_type?.toLowerCase() || "original",
        live_status:     budget.status || "Draft",
        parent_budget_id: parent?.id || null,
        parent_budget_no: parent?.budget_no || null,
        attachments:     finalAttachments,
      };

      const validated = BudgetAuditTrailSchema.safeParse(mappedData);
      if (!validated.success) {
        console.error("Zod Validation Error for Budget-Centric Log:", validated.error.format());
        return mappedData as unknown as BudgetAuditTrail;
      }
      return validated.data;
    });
  },

  async getBudgetLifecycle(budgetId: string | number): Promise<BudgetAuditTrail[]> {
    const query = new URLSearchParams({
      fields: "*,budget_id.*,budget_id.coa_id.*,budget_id.department_id.*,budget_id.division_id.*,performed_by.*,budget_id.budget_attachments.*",
      // Unified Lifecycle: Fetch logs for this budget OR any supplemental budgets attached to it
      "filter[_or][0][budget_id][_eq]": String(budgetId),
      "filter[_or][1][budget_id][parent_budget_id][_eq]": String(budgetId),
      sort: "-performed_at",
      limit: "-1",
    });

    const url = `${PROXY_URL}?${query.toString()}`;
    const result = await fetchProxy<{ data: RawAuditLogItem[] }>(url);
    const rawData = result?.data || [];

    // Extract unique budget IDs loaded in this timeline stream to bulk lookup file clips
    const uniqueBudgetIds = Array.from(new Set(rawData.map(log => typeof log.budget_id === 'object' ? (log.budget_id?.id || "") : log.budget_id).filter(Boolean)));
    const attachmentsMap: Record<string, RawAuditAttachment[]> = {};

    if (uniqueBudgetIds.length > 0) {
      try {
        const attQuery = new URLSearchParams({
          collection: "budget_attachments",
          "filter[budget_id][_in]": uniqueBudgetIds.join(","),
          fields: "id,budget_id,directus_id,file_name,file_type,file_size",
          limit: "-1"
        });
        const attRes = await fetchProxy<{ data: RawAuditAttachment[] }>(`${PROXY_URL}?${attQuery.toString()}`);
        if (attRes?.data) {
          attRes.data.forEach(att => {
            const bId = String(att.budget_id);
            if (!attachmentsMap[bId]) attachmentsMap[bId] = [];
            attachmentsMap[bId].push(att);
          });
        }
      } catch (attErr) {
        console.error("Bulk attachment lookup failed for lifecycle logs stream:", attErr);
      }
    }

    return rawData.map((log) => {
      const budget = typeof log.budget_id === 'object' ? log.budget_id : null;
      const coa = budget?.coa_id;
      const dept = budget?.department_id;
      const div = budget?.division_id;
      const user = log.performed_by;

      const targetBudgetId = String(budget?.id || log.budget_id || "");
      const nativeAtts = budget && Array.isArray(budget.budget_attachments) ? budget.budget_attachments : [];
      const bulkAtts = attachmentsMap[targetBudgetId] || [];
      const finalAttachments = nativeAtts.length > 0 ? nativeAtts : bulkAtts;

      const mappedData = {
        id: log.id,
        budget_id: targetBudgetId,
        action: log.action,
        previous_status: log.previous_status,
        new_status: log.new_status,
        previous_amount: log.previous_amount !== null && log.previous_amount !== undefined ? Number(log.previous_amount) : null,
        new_amount: Number(log.new_amount || 0),
        remarks: log.remarks,
        performed_by: {
          id: user?.user_id || user?.id || "",
          name: user ? `${user.user_fname || ""} ${user.user_lname || ""}`.trim() || "System" : "System",
          role: user?.user_position || "User",
          avatar: user?.user_avatar,
        },
        performed_at: log.performed_at,
        coa_name:        coa?.account_title || "—",
        gl_code:         coa?.gl_code || "—",
        department_name: dept?.department_name || "—",
        division_name:   div?.division_name || "—",
        month:           typeof budget?.month === 'string' ? MONTH_NAMES.indexOf(budget.month) + 1 : (Number(budget?.month) || 0),
        year:            Number(budget?.year) || 0,
        budget_no:       budget?.budget_no || "—",
        entry_type:      budget?.entry_type?.toLowerCase() || "original",
        live_status:     budget?.status || "Draft",
        attachments:     finalAttachments,
      };

      const validated = BudgetAuditTrailSchema.safeParse(mappedData);
      if (!validated.success) {
        console.error("Zod Validation Error for Lifecycle Log:", validated.error.format());
        return mappedData as unknown as BudgetAuditTrail;
      }
      return validated.data;
    });
  }
};
