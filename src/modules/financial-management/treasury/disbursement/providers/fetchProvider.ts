"use client";

// 🚀 FIX: Added COADto to the imports!
import {
    Disbursement,
    DisbursementPayload,
    PaginatedResponse,
    SupplierDto,
    COADto,
    BankAccountDto,
    UnpaidPoDto,
    MemoDto,
    DivisionDto,
    DepartmentDto,
    DisbursementDashboardData,
    DashboardFilters
} from "../types";

const API_BASE = "/api/fm/treasury/disbursements";
const SUPPLIER_API_BASE = "/api/fm/treasury/suppliers";

const toStoredSupplierType = (type: string) =>
    type.toUpperCase().startsWith("NON") ? "NON-TRADE" : "TRADE";

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
        const res = await fetch(`${SUPPLIER_API_BASE}?type=${encodeURIComponent(toStoredSupplierType(type))}`);
        if (!res.ok) throw new Error("Failed to fetch suppliers");
        return res.json();
    },

    createPayee: async (payload: {
        supplier_name: string;
        supplier_type: "TRADE" | "NON-TRADE";
        tin_number: string;
        bank_details?: string;
        email_address?: string;
        phone_number?: string;
    }): Promise<SupplierDto> => {
        const res = await fetch("/api/fm/payee-registration/payees", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Failed to create payee");
        return json.data as SupplierDto;
    },

    // 🚀 Fetch COAs for the Line Items
    getCOAs: async (): Promise<COADto[]> => {
        const res = await fetch("/api/fm/treasury/coas");
        if (!res.ok) throw new Error("Failed to fetch COAs");
        return res.json();
    },

    // 🚀 Fetch COAs restricted to payable account types (3,4,7,8,9,10)
    getPayableCOAs: async (): Promise<COADto[]> => {
        const res = await fetch("/api/fm/treasury/coas?forPayable=true");
        if (!res.ok) throw new Error("Failed to fetch payable COAs");
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

    getDashboardData: async (filters: DashboardFilters): Promise<DisbursementDashboardData> => {
        const params = new URLSearchParams();
        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);
        if (filters.status) params.append("status", filters.status);
        if (filters.payeeId) params.append("payeeId", filters.payeeId.toString());
        if (filters.transactionType) params.append("transactionType", filters.transactionType.toString()); // 🚀 NEW
        if (filters.encoderId) params.append("encoderId", filters.encoderId.toString());
        if (filters.coaId) params.append("coaId", filters.coaId.toString());
        if (filters.amount) params.append("amount", filters.amount.toString());
        if (filters.remarks) params.append("remarks", filters.remarks);

        const res = await fetch(`${API_BASE}/dashboard?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        return res.json();
    },

    getNextDocNo: async (supplierType: string = "Trade"): Promise<string> => {
        const res = await fetch(`${API_BASE}?nextDocNo=true&supplierType=${encodeURIComponent(supplierType)}`);
        if (!res.ok) throw new Error("Failed to fetch next doc no");
        const data = await res.json();
        return data.nextDocNo;
    }
};