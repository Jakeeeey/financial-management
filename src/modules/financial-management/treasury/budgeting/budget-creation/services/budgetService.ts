// src/modules/financial-management/treasury/budgeting/budget-creation/services/budgetService.ts

import type { Budget, CreateBudgetPayload, Division, Department, COA, BudgetAttachment } from "../types";
import type { BudgetAuditTrail, AuditTrailFilters } from "../../budget-audit-trail/types";

const PROXY_BASE_URL = "/api/fm/treasury/budgeting/budget-creation";
const PROXY_AUDIT_URL = "/api/fm/treasury/budgeting/budget-audit-trail";
const DIRECTUS_ASSETS_URL = process.env.NEXT_PUBLIC_API_BASE_URL + "/assets";

interface RawBudgetRecord {
  id?: string | number;
  division_id?: { division_id?: string | number; division_name?: string; id?: string | number } | number | null;
  department_id?: { department_id?: string | number; department_name?: string; id?: string | number } | number | null;
  coa_id?: { coa_id?: string | number; account_title?: string; gl_code?: string; id?: string | number } | number | null;
  parent_budget_id?: { id?: string | number } | string | number | null;
  budget_no?: string;
  amount?: string | number;
  month?: string | number;
  year?: string | number;
  status?: string;
  entry_type?: string;
  remarks?: string;
}

interface RawAttachmentRecord {
  id?: string | number;
  budget_id?: string | number;
  directus_id?: string;
  file_name?: string;
  file_type?: string;
  file_size?: string | number;
}

interface AttachmentCreateResponse {
  data?: {
    id?: string | number;
  };
}

interface RawAuditLogRecord {
  id?: string | number;
  budget_id?: RawBudgetRecord | string | number | null;
  action?: string;
  previous_status?: string;
  new_status?: string;
  previous_amount?: string | number | null;
  new_amount?: string | number;
  remarks?: string;
  performed_by?: { user_id?: string | number; id?: string | number; user_fname?: string; user_lname?: string; user_position?: string } | null;
  performed_at?: string;
}

export async function fetchProxy<T = unknown>(url: string, options: RequestInit = {}): Promise<T | null> {
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
      const message = err.message || (err.errors && err.errors[0] ? err.errors[0].message : null) || `Proxy Error: ${res.statusText}`;
      throw new Error(message);
    }

    if (res.status === 204) return null;
    
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return await res.json() as T;
    }
    
    return null;
  } catch (error) {
    console.error("Budget Proxy Error:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export const budgetService = {
  // ─── Core Budget CRUD ──────────────────────────────────────────────────────────

  async getBudgets(params: { 
    year?: number; 
    month?: string; 
    status?: string; 
    coa_id?: number; 
    division_id?: number; 
    department_id?: number; 
    limit?: number; 
    offset?: number;
    search?: string;
  } = {}): Promise<{ data: Budget[]; total: number }> {
    const query = new URLSearchParams({
      fields: "*,division_id.division_id,division_id.division_name,department_id.department_id,department_id.department_name,coa_id.coa_id,coa_id.account_title,coa_id.gl_code",
      meta: "filter_count",
    });
    if (params.limit !== undefined) {
      query.append("limit", String(params.limit));
    } else {
      query.append("limit", "-1");
    }
    if (params.offset !== undefined) query.append("offset", String(params.offset));
    if (params.year)   query.append("filter[year][_eq]", String(params.year));
    if (params.month)  query.append("filter[month][_eq]", params.month);
    if (params.status) query.append("filter[status][_eq]", params.status);
    if (params.coa_id) query.append("filter[coa_id][_eq]", String(params.coa_id));
    if (params.division_id) query.append("filter[division_id][_eq]", String(params.division_id));
    if (params.department_id) query.append("filter[department_id][_eq]", String(params.department_id));
    if (params.search) {
      const searchTerm = params.search.trim();
      if (searchTerm) {
        query.append("search", searchTerm);
      }
    }
    
    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data: RawBudgetRecord[]; meta: { filter_count: number } }>(url);
    const rawData = result?.data || [];
    const total = result?.meta?.filter_count || 0;
    
    // Bulk manual lookup for budget attachments mapped onto items
    const budgetIds = Array.from(new Set(rawData.map((b) => b.id).filter(Boolean)));
    const attachmentsMap = new Map<string, BudgetAttachment[]>();
    
    if (budgetIds.length > 0) {
      try {
        const attQuery = new URLSearchParams({
          "filter[budget_id][_in]": budgetIds.join(","),
          fields: "id,budget_id,directus_id,file_name,file_type,file_size",
          limit: "-1",
        });
        const attResult = await fetchProxy<{ data: RawAttachmentRecord[] }>(`${PROXY_BASE_URL}/budget_attachments?${attQuery.toString()}`);
        const rawAtts = attResult?.data || [];
        
        for (const att of rawAtts) {
          const bId = String(att.budget_id);
          if (!attachmentsMap.has(bId)) {
            attachmentsMap.set(bId, []);
          }
          attachmentsMap.get(bId)!.push({
            id: att.id || "",
            name: att.file_name || "Unnamed File",
            url: att.directus_id ? `${DIRECTUS_ASSETS_URL}/${att.directus_id}` : "#",
            type: att.file_type || "application/octet-stream",
            size: Number(att.file_size || 0),
          });
        }
      } catch (attErr) {
        console.error("Bulk attachment fetch error:", attErr);
      }
    }
    
    const budgets = rawData.map((b) => {
      // Directus expansion handling
      const div = b.division_id;
      const dept = b.department_id;
      const coa = b.coa_id;

      const divObj = typeof div === 'object' && div !== null ? div : null;
      const divId = divObj?.division_id || divObj?.id || (typeof div === 'number' ? div : undefined);

      const deptObj = typeof dept === 'object' && dept !== null ? dept : null;
      const deptId = deptObj?.department_id || deptObj?.id || (typeof dept === 'number' ? dept : undefined);

      const coaObj = typeof coa === 'object' && coa !== null ? coa : null;
      const coaId = coaObj?.coa_id || coaObj?.id || (typeof coa === 'number' ? coa : undefined);
      
      const bIdStr = String(b.id || "");
      const mappedAtts = attachmentsMap.get(bIdStr) || [];

      const parentObj = typeof b.parent_budget_id === 'object' && b.parent_budget_id !== null ? b.parent_budget_id : null;
      const parentId = parentObj?.id || (typeof b.parent_budget_id === 'string' || typeof b.parent_budget_id === 'number' ? b.parent_budget_id : null);

      return {
        ...b,
        id: bIdStr,
        parent_budget_id: parentId ? String(parentId) : null,
        budget_no:       b.budget_no || "N/A",
        division_name:   divObj?.division_name || "—",
        department_name: deptObj?.department_name || "—",
        coa_name:        coaObj?.account_title || "—",
        gl_code:         coaObj?.gl_code || "—",
        division_id:     divId ? String(divId) : undefined,
        department_id:   deptId ? String(deptId) : undefined,
        coa_id:          coaId ? String(coaId) : undefined,
        amount:          Number(b.amount || 0),
        attachments:     mappedAtts,
      } as unknown as Budget;
    });

    return { data: budgets, total };
  },

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    const url = `${PROXY_BASE_URL}/budget`;
    await fetchProxy(url, {
      method: "PATCH",
      body: JSON.stringify({
        keys: ids,
        data: { status },
      }),
    });
  },

  async checkDuplicate(year: number, month: string, coaId: number, divisionId: number, departmentId: number, excludeId?: string): Promise<boolean> {
    if (!year || !month || !coaId || !divisionId || !departmentId) return false;

    const query = new URLSearchParams({
      "filter[year][_eq]": String(year),
      "filter[month][_eq]": month,
      "filter[coa_id][_eq]": String(coaId),
      "filter[division_id][_eq]": String(divisionId),
      "filter[department_id][_eq]": String(departmentId),
      "filter[entry_type][_eq]": "original",
      "fields": "id",
      "limit": "1",
    });

    if (excludeId) {
      query.append("filter[id][_neq]", excludeId);
    }

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data: unknown[] }>(url);
    const data = result?.data || [];
    return (data && data.length > 0);
  },

  async generateBudgetNumber(year: number, month: string): Promise<string> {
    // Query backend to get the count of budgets for this period to determine increment
    const query = new URLSearchParams({
      "filter[year][_eq]": String(year),
      "filter[month][_eq]": month,
      "meta": "total_count",
      "limit": "0" // We only need the meta count
    });
    
    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ meta: { total_count: number } }>(url);
    const count = (result?.meta?.total_count || 0) + 1;
    
    // Format: BDGT-MMYYYY-XXXX
    const monthIndex = MONTH_NAMES.indexOf(month) + 1;
    const mm = String(monthIndex).padStart(2, '0');
    const yyyy = String(year);
    const xxxx = String(count).padStart(4, '0');
    
    return `BDGT-${mm}${yyyy}-${xxxx}`;
  },

  async createBudget(payload: CreateBudgetPayload): Promise<Budget> {
    const budgetUrl = `${PROXY_BASE_URL}/budget`;
    
    // Auto-generate budget_no if not provided
    if (!payload.budget_no) {
      const monthName = typeof payload.month === 'number' 
        ? MONTH_NAMES[payload.month - 1] 
        : payload.month;
      
      payload.budget_no = await this.generateBudgetNumber(payload.year, monthName);
    }

    const { attachments, ...budgetData } = payload;
    
    const result = await fetchProxy<{ data: unknown }>(budgetUrl, {
      method: "POST",
      body: JSON.stringify(budgetData),
    });
    const budget = result?.data as Budget;

    if (budget?.id && attachments && attachments.length > 0) {
      try {
        await this.uploadAttachments(budget.id, attachments);
      } catch (error) {
        try {
          await this.deleteBudget(budget.id);
        } catch (rollbackError) {
          console.error("Failed to roll back budget after attachment upload failure:", rollbackError);
        }

        console.error("Attachment upload failed after budget creation:", error);
        throw new Error("Budget was not created because attachment upload failed. Please try again.");
      }
    }

    return budget;
  },

  async updateBudget(id: string | number, payload: Partial<CreateBudgetPayload>): Promise<Budget> {
    const { attachments, ...budgetData } = payload;
    const url = `${PROXY_BASE_URL}/budget?id=${id}`;
    
    const result = await fetchProxy<{ data: unknown }>(url, {
      method: "PATCH",
      body: JSON.stringify(budgetData),
    });
    const data = result?.data as Budget;

    if (attachments && attachments.length > 0) {
      await this.uploadAttachments(id, attachments);
    }

    return data;
  },

  async deleteBudget(id: string | number): Promise<void> {
    const url = `${PROXY_BASE_URL}/budget?id=${id}`;
    await fetchProxy(url, { method: "DELETE" });
  },

  async submitBudgets(ids: string[]): Promise<void> {
    const url = `${PROXY_BASE_URL}/budget`;
    await fetchProxy(url, {
      method: "PATCH",
      body: JSON.stringify({
        keys: ids,
        data: { status: "Pending" },
      }),
    });
  },

  // ─── Attachments ──────────────────────────────────────────────────────────────

  async getAttachments(budgetId: string | number): Promise<BudgetAttachment[]> {
    const url = `${PROXY_BASE_URL}/budget_attachments?filter[budget_id][_eq]=${budgetId}&fields=id,directus_id,file_name,file_type,file_size&limit=-1`;
    const result = await fetchProxy<{ data: RawAttachmentRecord[] }>(url);
    const rawData = result?.data || [];
    
    return rawData.map((att) => ({
      id:   att.id,
      name: att.file_name || "Unnamed File",
      url:  att.directus_id ? `${DIRECTUS_ASSETS_URL}/${att.directus_id}` : "#",
      type: att.file_type || "application/octet-stream",
      size: Number(att.file_size || 0),
    } as BudgetAttachment));
  },

  async deleteDirectusFile(fileId: string): Promise<void> {
    const url = `${PROXY_BASE_URL}/files?id=${encodeURIComponent(fileId)}`;
    await fetchProxy(url, { method: "DELETE" });
  },

  async cleanupUploadedAttachments(attachmentIds: Array<string | number>, directusFileIds: string[]): Promise<void> {
    const cleanupResults = await Promise.allSettled([
      ...attachmentIds.map((id) => this.deleteAttachment(id)),
      ...directusFileIds.map((id) => this.deleteDirectusFile(id)),
    ]);

    for (const result of cleanupResults) {
      if (result.status === "rejected") {
        console.error("Attachment cleanup failed:", result.reason);
      }
    }
  },

  async uploadAttachments(budgetId: string | number, files: File[]): Promise<void> {
    const createdAttachmentIds: Array<string | number> = [];
    const orphanDirectusFileIds = new Set<string>();

    try {
      const result = await fetchProxy<{ data: Array<{ id: string }> }>(`${PROXY_BASE_URL}/folders?filter[name][_eq]=budget_attachments`);
      const folders = result?.data;
      const folderId = folders?.[0]?.id;

      if (!folderId) {
        throw new Error("Budget attachments folder was not found.");
      }

      for (const file of files) {
        const formData = new FormData();
        formData.append("folder", folderId);
        formData.append("file", file);

        const uploadResult = await fetchProxy<{ data: { id: string } }>(`${PROXY_BASE_URL}/files`, {
          method: "POST",
          body: formData,
        });
        const uploadedFile = uploadResult?.data;

        if (!uploadedFile?.id) {
          throw new Error(`Directus did not return a file ID for ${file.name}.`);
        }

        orphanDirectusFileIds.add(uploadedFile.id);

        const truncatedType = file.type.length > 50 
          ? file.type.substring(0, 47) + "..." 
          : file.type;

        const attachmentResult = await fetchProxy<AttachmentCreateResponse>(`${PROXY_BASE_URL}/budget_attachments`, {
          method: "POST",
          body: JSON.stringify({
            budget_id: budgetId,
            directus_id: uploadedFile.id,
            file_name: file.name,
            file_type: truncatedType,
            file_size: file.size,
          }),
        });
        const attachmentId = attachmentResult?.data?.id;

        if (!attachmentId) {
          throw new Error(`Attachment record was not created for ${file.name}.`);
        }

        createdAttachmentIds.push(attachmentId);
        orphanDirectusFileIds.delete(uploadedFile.id);
      }
    } catch (error) {
      await this.cleanupUploadedAttachments(createdAttachmentIds, Array.from(orphanDirectusFileIds));
      throw error instanceof Error ? error : new Error(String(error));
    }
  },

  async deleteAttachment(attachmentId: string | number): Promise<void> {
    const url = `${PROXY_BASE_URL}/budget_attachments?id=${attachmentId}`;
    await fetchProxy(url, { method: "DELETE" });
  },

  async getUsedCoaIds(year: number, monthName: string, divisionId: number, departmentId: number, excludeId?: string): Promise<number[]> {
    if (!year || !monthName || !divisionId || !departmentId) return [];

    const query = new URLSearchParams({
      "filter[year][_eq]": String(year),
      "filter[month][_eq]": monthName,
      "filter[division_id][_eq]": String(divisionId),
      "filter[department_id][_eq]": String(departmentId),
      "filter[entry_type][_eq]": "original",
      fields: "coa_id",
      limit: "-1",
    });

    if (excludeId) {
      query.append("filter[id][_neq]", excludeId);
    }

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data: Array<{ coa_id?: { coa_id?: number; id?: number } | number | null }> }>(url);
    const rawData = result?.data || [];

    return rawData
      .map((b) => {
        const coa = b.coa_id;
        if (typeof coa === "number") return coa;
        return coa?.coa_id || coa?.id || null;
      })
      .filter((id: number | null): id is number => id !== null);
  },

  // ─── Lookups ──────────────────────────────────────────────────────────────────

  async getDivisions(): Promise<Division[]> {
    const url = `${PROXY_BASE_URL}/division?fields=division_id,division_name&limit=-1`;
    const result = await fetchProxy<{ data: Division[] }>(url);
    return result?.data || [];
  },

  async getDepartments(divisionId: number): Promise<Department[]> {
    if (!divisionId || isNaN(divisionId)) return [];
    
    const url = `${PROXY_BASE_URL}/department_per_division?filter[division_id][_eq]=${divisionId}&fields=id,department_id.department_id,department_id.department_name&limit=-1`;
    const result = await fetchProxy<{ data: Array<{ id?: number; department_id?: { department_id?: number; department_name?: string; id?: number } }> }>(url);
    const rawData = result?.data || [];
    
    return rawData.map((d) => ({
      department_id:   d.department_id?.department_id || d.department_id?.id,
      department_name: d.department_id?.department_name || "—",
      parent_division: divisionId,
      dept_div_id:     d.id,
    } as Department));
  },

  async getCOAs(deptDivId: number): Promise<COA[]> {
    if (!deptDivId || isNaN(deptDivId)) return [];

    const query = new URLSearchParams({
        fields: "id,coa_id.coa_id,coa_id.account_title,coa_id.gl_code",
        limit: "-1",
    });
    if (deptDivId) {
        query.append("filter[dept_div_id][_eq]", String(deptDivId));
    }
    
    const url = `${PROXY_BASE_URL}/department_division_coa?${query.toString()}`;
    const result = await fetchProxy<{ data: Array<{ coa_id?: { coa_id?: number; account_title?: string; gl_code?: string; id?: number } }> }>(url);
    const rawData = result?.data || [];
    
    return rawData.map((item) => ({
      coa_id:   item.coa_id?.coa_id || item.coa_id?.id,
      account_title: item.coa_id?.account_title || "—",
      gl_code: item.coa_id?.gl_code || "—",
    } as COA));
  },

  async getAuditLogs(filters: AuditTrailFilters): Promise<BudgetAuditTrail[]> {
    const query = new URLSearchParams({
      fields: "*,budget_id.*,budget_id.coa_id.*,budget_id.department_id.*,budget_id.division_id.*,performed_by.*",
      limit: "-1",
    });
    
    if (filters.status) query.append("filter[new_status][_eq]", filters.status);
    if (filters.user_id) query.append("filter[performed_by][_eq]", filters.user_id);
    
    if (filters.date_from) query.append("filter[performed_at][_gte]", filters.date_from);
    if (filters.date_to) query.append("filter[performed_at][_lte]", filters.date_to);

    if (filters.division_id) query.append("filter[budget_id][division_id][_eq]", filters.division_id);
    if (filters.department_id) query.append("filter[budget_id][department_id][_eq]", filters.department_id);

    const url = `${PROXY_AUDIT_URL}?${query.toString()}`;
    const result = await fetchProxy<{ data: RawAuditLogRecord[] }>(url);
    const rawData = result?.data || [];

    // Extract unique budget IDs to map manual attachments
    const uniqueIds = Array.from(new Set(rawData.map(log => typeof log.budget_id === 'object' ? log.budget_id?.id : log.budget_id).filter(Boolean)));
    const attachmentsMap: Record<string, BudgetAttachment[]> = {};

    if (uniqueIds.length > 0) {
      try {
        const attQuery = new URLSearchParams({
          "filter[budget_id][_in]": uniqueIds.join(","),
          fields: "id,budget_id,directus_id,file_name,file_type,file_size",
          limit: "-1"
        });
        const attRes = await fetchProxy<{ data: RawAttachmentRecord[] }>(`${PROXY_BASE_URL}/budget_attachments?${attQuery.toString()}`);
        if (attRes?.data) {
          attRes.data.forEach(att => {
            const bId = String(att.budget_id);
            if (!attachmentsMap[bId]) attachmentsMap[bId] = [];
            attachmentsMap[bId].push({
              id: att.id || "",
              name: att.file_name || "Unnamed File",
              url: att.directus_id ? `${DIRECTUS_ASSETS_URL}/${att.directus_id}` : "#",
              type: att.file_type || "application/octet-stream",
              size: Number(att.file_size || 0),
            });
          });
        }
      } catch (attErr) {
        console.error("Bulk attachment fetching error for audit logs:", attErr);
      }
    }

    return rawData.map((log) => {
      const budget = log.budget_id;
      const budgetObj = typeof budget === 'object' && budget !== null ? budget : null;
      const coaObj = typeof budgetObj?.coa_id === 'object' && budgetObj.coa_id !== null ? budgetObj.coa_id : null;
      const deptObj = typeof budgetObj?.department_id === 'object' && budgetObj.department_id !== null ? budgetObj.department_id : null;
      const divObj = typeof budgetObj?.division_id === 'object' && budgetObj.division_id !== null ? budgetObj.division_id : null;
      const user = log.performed_by;
      
      const bIdStr = String(budgetObj?.id || (typeof budget === 'string' || typeof budget === 'number' ? budget : ""));
      const finalAttachments = attachmentsMap[bIdStr] || [];

      return {
        id: log.id,
        budget_id: bIdStr,
        action: log.action,
        previous_status: log.previous_status,
        new_status: log.new_status,
        previous_amount: Number(log.previous_amount || 0),
        new_amount: Number(log.new_amount || 0),
        remarks: log.remarks,
        performed_by: {
          id: user?.user_id || user?.id || "",
          name: user ? `${user.user_fname || ""} ${user.user_lname || ""}`.trim() || "System" : "System",
          role: user?.user_position || "User",
        },
        performed_at: log.performed_at,
        // Contextual data for display
        coa_name:        coaObj?.account_title || "—",
        gl_code:         coaObj?.gl_code || "—",
        department_name: deptObj?.department_name || "—",
        division_name:   divObj?.division_name || "—",
        month:           typeof budgetObj?.month === 'string' ? MONTH_NAMES.indexOf(budgetObj.month) + 1 : (Number(budgetObj?.month) || 0),
        year:            Number(budgetObj?.year) || 0,
        budget_no:       budgetObj?.budget_no || "—",
        entry_type:      budgetObj?.entry_type || "original",
        attachments:     finalAttachments,
      } as unknown as BudgetAuditTrail;
    });
  },

  async getBudgetLifecycle(budgetId: string | number): Promise<BudgetAuditTrail[]> {
    const query = new URLSearchParams({
      fields: "*,budget_id.*,budget_id.coa_id.*,budget_id.department_id.*,budget_id.division_id.*,performed_by.*",
      "filter[_or][0][budget_id][_eq]": String(budgetId),
      "filter[_or][1][budget_id][parent_budget_id][_eq]": String(budgetId),
      sort: "performed_at",
      limit: "-1",
    });

    const url = `${PROXY_AUDIT_URL}?${query.toString()}`;
    const result = await fetchProxy<{ data: RawAuditLogRecord[] }>(url);
    const rawData = result?.data || [];

    const uniqueIds = Array.from(new Set(rawData.map(log => typeof log.budget_id === 'object' ? log.budget_id?.id : log.budget_id).filter(Boolean)));
    const attachmentsMap: Record<string, BudgetAttachment[]> = {};

    if (uniqueIds.length > 0) {
      try {
        const attQuery = new URLSearchParams({
          "filter[budget_id][_in]": uniqueIds.join(","),
          fields: "id,budget_id,directus_id,file_name,file_type,file_size",
          limit: "-1"
        });
        const attRes = await fetchProxy<{ data: RawAttachmentRecord[] }>(`${PROXY_BASE_URL}/budget_attachments?${attQuery.toString()}`);
        if (attRes?.data) {
          attRes.data.forEach(att => {
            const bId = String(att.budget_id);
            if (!attachmentsMap[bId]) attachmentsMap[bId] = [];
            attachmentsMap[bId].push({
              id: att.id || "",
              name: att.file_name || "Unnamed File",
              url: att.directus_id ? `${DIRECTUS_ASSETS_URL}/${att.directus_id}` : "#",
              type: att.file_type || "application/octet-stream",
              size: Number(att.file_size || 0),
            });
          });
        }
      } catch (attErr) {
        console.error("Bulk attachment fetching error for lifecycle:", attErr);
      }
    }

    return rawData.map((log) => {
      const budget = log.budget_id;
      const budgetObj = typeof budget === 'object' && budget !== null ? budget : null;
      const coaObj = typeof budgetObj?.coa_id === 'object' && budgetObj.coa_id !== null ? budgetObj.coa_id : null;
      const deptObj = typeof budgetObj?.department_id === 'object' && budgetObj.department_id !== null ? budgetObj.department_id : null;
      const divObj = typeof budgetObj?.division_id === 'object' && budgetObj.division_id !== null ? budgetObj.division_id : null;
      const user = log.performed_by;

      const targetBudgetId = String(budgetObj?.id || (typeof budget === 'string' || typeof budget === 'number' ? budget : ""));
      const finalAttachments = attachmentsMap[targetBudgetId] || [];

      return {
        id: log.id,
        budget_id: targetBudgetId,
        action: log.action,
        previous_status: log.previous_status,
        new_status: log.new_status,
        previous_amount: log.previous_amount !== null ? Number(log.previous_amount) : null,
        new_amount: Number(log.new_amount || 0),
        remarks: log.remarks,
        performed_by: {
          id: user?.user_id || user?.id || "",
          name: user ? `${user.user_fname || ""} ${user.user_lname || ""}`.trim() || "System" : "System",
          role: user?.user_position || "User",
        },
        performed_at: log.performed_at,
        coa_name:        coaObj?.account_title || "—",
        gl_code:         coaObj?.gl_code || "—",
        department_name: deptObj?.department_name || "—",
        division_name:   divObj?.division_name || "—",
        month:           typeof budgetObj?.month === 'string' ? MONTH_NAMES.indexOf(budgetObj.month) + 1 : (Number(budgetObj?.month) || 0),
        year:            Number(budgetObj?.year) || 0,
        budget_no:       budgetObj?.budget_no || "—",
        entry_type:      budgetObj?.entry_type || "original",
        live_status:     budgetObj?.status || log.new_status,
        attachments:     finalAttachments,
      } as unknown as BudgetAuditTrail;
    });
  },
};
