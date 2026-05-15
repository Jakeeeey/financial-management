// src/modules/financial-management/treasury/disbursement/providers/fetchProvider.ts
"use client";

// 🚀 FIX: Added COADto to the imports!
import {
  BankAccountDto,
  COADto,
  DepartmentDto,
  Disbursement,
  DisbursementPayload,
  DivisionDto,
  MemoDto,
  PaginatedResponse,
  SupplierDto,
  UnpaidPoDto,
} from "../types";

const API_BASE = "/api/fm/treasury/disbursements";
const SUPPLIER_API_BASE = "/api/fm/treasury/suppliers";

type LookupRow = Record<string, unknown>;

/**
 * Extracts array rows from either direct array payloads or Directus-style data wrappers.
 */
const getRows = (payload: unknown): LookupRow[] => {
  if (Array.isArray(payload))
    return payload.filter(
      (row): row is LookupRow =>
        row !== null && typeof row === "object" && !Array.isArray(row),
    );

  if (payload !== null && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data))
      return data.filter(
        (row): row is LookupRow =>
          row !== null && typeof row === "object" && !Array.isArray(row),
      );
  }

  return [];
};

/**
 * Converts raw API ID values into a number while rejecting blank and invalid values.
 */
const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/**
 * Normalizes division lookup responses from Spring or Directus field naming conventions.
 */
const normalizeDivisions = (payload: unknown): DivisionDto[] =>
  getRows(payload).reduce<DivisionDto[]>((rows, row) => {
    const id = toNumber(row.id ?? row.divisionId ?? row.division_id);
    const divisionName = toString(
      row.divisionName ?? row.division_name ?? row.name ?? row.division,
    );

    if (id !== null && divisionName) rows.push({ id, divisionName });
    return rows;
  }, []);

/**
 * Normalizes department lookup responses into the DTO shape used by disbursement controls.
 */
const normalizeDepartments = (payload: unknown): DepartmentDto[] =>
  getRows(payload).reduce<DepartmentDto[]>((rows, row) => {
    const id = toNumber(row.id ?? row.departmentId ?? row.department_id);
    const departmentName = toString(
      row.departmentName ?? row.department_name ?? row.name ?? row.department,
    );

    if (id !== null && departmentName) rows.push({ id, departmentName });
    return rows;
  }, []);

/**
 * Normalizes supplier lookup responses so payee dropdown values stay stable.
 */
const normalizeSuppliers = (payload: unknown): SupplierDto[] =>
  getRows(payload).reduce<SupplierDto[]>((rows, row) => {
    const id = toNumber(row.id ?? row.supplierId ?? row.supplier_id);
    const supplierName = toString(
      row.supplier_name ?? row.supplierName ?? row.name ?? row.supplier,
    );

    if (id !== null && supplierName) {
      rows.push({
        id,
        supplier_name: supplierName,
        supplier_shortcut:
          toString(row.supplier_shortcut ?? row.supplierShortcut) || undefined,
        isActive: row.isActive === undefined ? true : Boolean(row.isActive),
      });
    }

    return rows;
  }, []);

export const disbursementProvider = {
  getDisbursements: async (
    page: number = 0,
    size: number = 20,
    type: string = "All",
    supplier: string = "",
    startDate: string = "",
    endDate: string = "",
    status: string = "All",
    divisionId: string = "",
    departmentId: string = "",
    docNo: string = "",
  ): Promise<PaginatedResponse<Disbursement>> => {
    let url = `${API_BASE}?page=${page}&size=${size}&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`;
    if (supplier) url += `&supplier=${encodeURIComponent(supplier)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    if (divisionId) url += `&divisionId=${divisionId}`;
    if (departmentId) url += `&departmentId=${departmentId}`;
    if (docNo) url += `&docNo=${encodeURIComponent(docNo)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch disbursements");
    return res.json();
  },

  createDisbursement: async (
    payload: DisbursementPayload,
  ): Promise<Disbursement> => {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create disbursement");
    return res.json();
  },

  updateStatus: async (id: number, status: string): Promise<Disbursement> => {
    const res = await fetch(
      `${API_BASE}/${id}/status?status=${encodeURIComponent(status)}`,
      {
        method: "PATCH",
      },
    );
    if (!res.ok) {
      // 🚀 Catch the BFF/Spring Boot error payload!
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.detail ||
          errData.message ||
          errData.error ||
          "Failed to update status",
      );
    }
    return res.json();
  },

  // 🚀 Fetch Suppliers for the Dropdown
  getSuppliers: async (type: string = "Trade"): Promise<SupplierDto[]> => {
    const res = await fetch(
      `${SUPPLIER_API_BASE}?type=${encodeURIComponent(type)}`,
    );
    if (!res.ok) throw new Error("Failed to fetch suppliers");
    return normalizeSuppliers(await res.json());
  },

  // 🚀 Fetch COAs for the Line Items
  getCOAs: async (): Promise<COADto[]> => {
    const res = await fetch("/api/fm/treasury/coas");
    if (!res.ok) throw new Error("Failed to fetch COAs");
    return res.json();
  },

  getBanks: async (): Promise<BankAccountDto[]> => {
    const res = await fetch("/api/fm/treasury/bank-accounts/active");
    if (!res.ok) throw new Error("Failed to fetch banks");
    return res.json();
  },

  updateDisbursement: async (
    id: number,
    payload: DisbursementPayload,
  ): Promise<Disbursement> => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update disbursement");
    return res.json();
  },
  getUnpaidPos: async (supplierId: number): Promise<UnpaidPoDto[]> => {
    const res = await fetch(
      `/api/fm/treasury/disbursements/unpaid-pos/${supplierId}`,
    );
    if (!res.ok) throw new Error("Failed to fetch unpaid POs");
    return res.json();
  },
  getSupplierMemos: async (supplierId: number): Promise<MemoDto[]> => {
    const res = await fetch(
      `/api/fm/treasury/disbursements/memos/${supplierId}`,
    );
    if (!res.ok) throw new Error("Failed to fetch supplier memos");
    return res.json();
  },
  getDivisions: async (): Promise<DivisionDto[]> => {
    const res = await fetch("/api/fm/setup/divisions");
    if (!res.ok) throw new Error("Failed to fetch divisions");
    return normalizeDivisions(await res.json());
  },

  getDepartments: async (): Promise<DepartmentDto[]> => {
    const res = await fetch("/api/fm/setup/departments");
    if (!res.ok) throw new Error("Failed to fetch departments");
    return normalizeDepartments(await res.json());
  },

  /**
   * Fetches only departments linked to the selected division for the voucher form.
   */
  getDepartmentsByDivision: async (
    divisionId: number,
  ): Promise<DepartmentDto[]> => {
    const res = await fetch(
      `/api/fm/setup/departments/by-division?divisionId=${encodeURIComponent(divisionId)}`,
    );
    if (!res.ok) throw new Error("Failed to fetch departments for division");
    return normalizeDepartments(await res.json());
  },
};
