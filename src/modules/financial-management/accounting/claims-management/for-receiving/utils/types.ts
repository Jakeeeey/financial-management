//src/modules/financial-management/claims-management/for-receiving/utils/types.ts
export type PickItem = { id: number; label: string };

export type TransmittalRow = {
    id: number;
    transmittal_no: string;
    supplier_id: number;
    supplier_representative_id: number;
    total_amount: number | string;
    status: string;
    created_at?: string | null;

    supplier_name?: string;
    representative_name?: string;

    // ✅ new: list API already provides this (so you can drop useTransmittalCounts later)
    ccm_count?: number;
    created_by_id?: number | null;
    created_by_name?: string | null;
};

export type TransmittalDetailRow = {
    id: number;
    claims_transmittal_id: number;
    customer_memo_id: number;

    amount: number | string;

    // memo info
    memo_number?: string | null;
    reason?: string | null;
    memo_status?: string | null;

    // NEW fields
    credit_date?: string | null;        // customers_memo.created_at
    chart_of_account?: number | null;
    gl_code?: string | null;
    account_title?: string | null;

    supplier_id?: number | null;
    supplier_name?: string | null;

    customer_id?: number | null;
    customer_name?: string | null;

    received_at?: string | null;
};
// src/modules/financial-management/claims-management/for-receiving/providers/receivingApi.ts

export type CompanyProfile = {
    company_id: number;
    company_name?: string | null;
    company_type?: string | null;
    company_code?: string | null;

    company_firstAddress?: string | null;
    company_secondAddress?: string | null;

    company_registrationNumber?: string | null;
    company_tin?: string | null;
    company_dateAdmitted?: string | null;

    company_contact?: string | null;
    company_email?: string | null;

    company_logo?: string | null;
};

export type CCMRow = {
    id: number;
    memo_number?: string | null;
    reason?: string | null;
    amount?: string | number | null;

    supplier_id?: number | null;
    customer_id?: number | null;
    customer_name?: string | null;
};
