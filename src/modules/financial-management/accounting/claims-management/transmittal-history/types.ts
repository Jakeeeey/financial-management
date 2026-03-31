//src/modules/financial-management/claims-management/transmittal-history/types.ts
export type TransmittalStatus =
    | "FOR RECEIVING"
    | "FOR PAYMENT"
    | "POSTED"
    | "RECEIVED"
    | string;

export type TransmittalHistoryDetail = {
    id: number;
    customer_memo_id: number;
    memo_number: string; // from customers_memo.memo_number
    reason?: string | null; // from customers_memo.reason
    amount: number; // detail.amount (or memo.amount depending on backend)
    received_at?: string | null;
    remarks?: string | null;
};

export type TransmittalHistoryRow = {
    id: number;
    transmittal_no: string;
    supplier_id: number;
    supplier_name: string;
    supplier_representative_id: number;
    representative_name: string;
    created_at: string;

    status: TransmittalStatus;

    total_amount: number;
    ccm_count: number;

    details: TransmittalHistoryDetail[];
};
