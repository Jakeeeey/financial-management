//src/modules/financial-management-system/claims-management/ccm-list/utils/types.ts
export type BufferLike =
    | { type: "Buffer"; data: number[] }
    | { type: string; data: number[] };

export type CCMRow = {
    id: number;
    memo_number: string;
    reason: string | null;
    status: string | null;

    amount: number | string | null;
    applied_amount: number | string | null;

    chart_of_account: number | null;
    customer_id: number | null;
    supplier_id: number | null;
    salesman_id: number | null;

    // ✅ enriched display fields
    supplier_name?: string | null;
    customer_name?: string | null;

    customer_reference: string | null;
    supplier_reference: string | null;

    encoder_id: number | null;

    isClaimed: boolean | number | BufferLike | null;
    isPending: boolean | number | BufferLike | null;

    type: number | null;

    created_at: string | null;
    updated_at: string | null;
};

export type CCMListResponse = {
    data: CCMRow[];
    meta?: {
        filter_count?: number;
        total_count?: number;
    };
};

export type CCMListQuery = {
    q?: string;
    status?: string;
    supplier_id?: string;
    customer_id?: string;
    pending?: "1" | "0" | "";
    claimed?: "1" | "0" | "";
    page?: number;
    pageSize?: number;
};
