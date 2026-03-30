// src/modules/financial-management/claims-management/generate-transmittals/utils/types.ts

export type BitLike =
    | boolean
    | number
    | string
    | null
    | undefined
    | { type?: "Buffer"; data?: number[] }
    | number[];

export type CCMRow = {
    id: number;
    memo_number: string;
    reason: string | null;
    status: string | null;
    amount: number | string | null;

    supplier_id: number | null;
    customer_id: number | null;

    // ✅ optional, for table view
    customer_name?: string | null;

    // ✅ optional, for COA filter + display
    coa_id?: number | null;
    gl_code?: string | null;
    account_title?: string | null;

    // ✅ Directus BIT(1) can come as boolean/0-1/"0-1"/Buffer-like
    isPending?: BitLike;
    isClaimed?: BitLike;

    created_at?: string | null;
};

export type PickItem = { id: number; label: string };

export type CreateTransmittalResult = {
    id: number;
    transmittal_no: string;
    supplier_id: number;
    supplier_representative_id: number;
    status: string;
    total_amount: number;
    count: number;
};