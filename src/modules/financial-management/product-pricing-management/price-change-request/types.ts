export type PCRStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type PriceTypeRef = {
    price_type_id: number;
    price_type_name?: string;
};

export type ProductRef = {
    product_id: number;
    product_code?: string;
    product_name?: string;
};

export type PriceChangeRequestRow = {
    request_id: number;
    product_id: number | ProductRef;
    price_type_id: number | PriceTypeRef;
    proposed_price: number;
    status: PCRStatus;

    requested_by: number;
    requested_at: string;

    approved_by?: number | null;
    approved_at?: string | null;

    rejected_by?: number | null;
    rejected_at?: string | null;
    reject_reason?: string | null;
};

export type ListMeta = {
    total_count?: number;
};

export type ListQuery = {
    status?: PCRStatus | "";
    q?: string;
    product_id?: number | "";
    price_type_id?: number | "";
    requested_by?: number | "";
    page?: number;
    page_size?: number;
};

export type CreatePCRPayload = {
    product_id: number;
    price_type_id: number;
    proposed_price: number;
};

export type ActionPayload =
    | { action: "approve"; request_id: number }
    | { action: "cancel"; request_id: number }
    | { action: "reject"; request_id: number; reject_reason: string };

export type ApproveManyResult = {
    successIds: number[];
    failedIds: number[];
};