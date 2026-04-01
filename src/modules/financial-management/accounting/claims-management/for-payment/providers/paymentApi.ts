// src/modules/financial-management/claims-management/for-payment/providers/paymentApi.ts
import type { TransmittalDetailRow, TransmittalRow } from "../utils/types";
import type { CompanyProfile } from "../utils/printTransmittalPaymentA4";

export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
    const res = await fetch(`/api/company`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Failed to fetch company profile");
    return (json?.data ?? null) as CompanyProfile | null;
}

export async function fetchForPaymentTransmittals(): Promise<TransmittalRow[]> {
    const res = await fetch(`/api/fm/accounting/claims/for-payments/transmittals?status=FOR%20PAYMENT`, {
        cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed to fetch transmittals");
    return json.data ?? [];
}

export async function fetchTransmittalDetails(transmittalId: number): Promise<TransmittalDetailRow[]> {
    const res = await fetch(`/api/fm/accounting/claims/for-payments/transmittal-details?transmittal_id=${transmittalId}`, {
        cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed to fetch details");
    return json.data ?? [];
}

export async function updateCustomerMemoFlags(args: {
    memoId: number;
    isPending: 0 | 1;
    isClaimed: 0 | 1;
}): Promise<void> {
    const res = await fetch(`/api/fm/accounting/claims/for-payments/customer-memo-flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            memo_id: args.memoId,
            isPending: args.isPending,
            isClaimed: args.isClaimed,
        }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Failed to update memo flags");
}

export async function markTransmittalPosted(args: {
    transmittalId: number;
    includedMemoIds: number[];
    excludedMemoIds: number[];
}): Promise<void> {
    const res = await fetch(`/api/fm/accounting/claims/for-payments/transmittal-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: args.transmittalId,
            status: "POSTED",
            included_memo_ids: args.includedMemoIds,
            excluded_memo_ids: args.excludedMemoIds,
        }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Failed to update status");
}