"use client";

// 🚀 FIX: Added COADto to the imports!
import {
    Disbursement,
    DisbursementPayload,
    PaginatedResponse,
    SupplierDto,
    COADto,
    BankAccountDto,
    UnpaidPoDto, MemoDto, DivisionDto, DepartmentDto
} from "../types";

const API_BASE = "/api/fm/treasury/disbursements";
const SUPPLIER_API_BASE = "/api/fm/treasury/suppliers";

export const disbursementProvider = {
    getDisbursements: async (
        page: number = 0, size: number = 20, type: string = "All",
        supplier: string = "", startDate: string = "", endDate: string = "",
        status: string = "All", divisionId: string = "", departmentId: string = "", docNo: string = ""
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

    createDisbursement: async (payload: DisbursementPayload): Promise<Disbursement> => {
        const res = await fetch(API_BASE, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create disbursement");
        return res.json();
    },

    updateStatus: async (id: number, status: string): Promise<Disbursement> => {
        const res = await fetch(`${API_BASE}/${id}/status?status=${encodeURIComponent(status)}`, {
            method: "PATCH",
        });
        if (!res.ok) {
            // 🚀 Catch the BFF/Spring Boot error payload!
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || errData.message || errData.error || "Failed to update status");
        }
        return res.json();
    },

    // 🚀 Fetch Suppliers for the Dropdown
    getSuppliers: async (type: string = "Trade"): Promise<SupplierDto[]> => {
        const res = await fetch(`${SUPPLIER_API_BASE}?type=${encodeURIComponent(type)}`);
        if (!res.ok) throw new Error("Failed to fetch suppliers");
        return res.json();
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

    updateDisbursement: async (id: number, payload: DisbursementPayload): Promise<Disbursement> => {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update disbursement");
        return res.json();
    },
    getUnpaidPos: async (supplierId: number): Promise<UnpaidPoDto[]> => {
        const res = await fetch(`/api/fm/treasury/disbursements/unpaid-pos/${supplierId}`);
        if (!res.ok) throw new Error("Failed to fetch unpaid POs");
        return res.json();
    },
    getSupplierMemos: async (supplierId: number): Promise<MemoDto[]> => {
        const res = await fetch(`/api/fm/treasury/disbursements/memos/${supplierId}`);
        if (!res.ok) throw new Error("Failed to fetch supplier memos");
        return res.json();
    },
    getDivisions: async (): Promise<DivisionDto[]> => {
        // Replace with your actual division API route if different
        const res = await fetch("/api/fm/setup/divisions");
        if (!res.ok) throw new Error("Failed to fetch divisions");
        return res.json();
    },

    getDepartments: async (): Promise<DepartmentDto[]> => {
        // Replace with your actual department API route if different
        const res = await fetch("/api/fm/setup/departments");
        if (!res.ok) throw new Error("Failed to fetch departments");
        return res.json();
    },
};