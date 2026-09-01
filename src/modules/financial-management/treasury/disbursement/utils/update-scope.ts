export const RELEASING_PAYMENT_SCOPE = "RELEASING_PAYMENT" as const;

export type DisbursementUpdateScope = "VOUCHER" | typeof RELEASING_PAYMENT_SCOPE;

export function isPaymentAllocationScope(value: unknown): value is typeof RELEASING_PAYMENT_SCOPE {
    return value === RELEASING_PAYMENT_SCOPE;
}

export function resolveDisbursementUpdateStatus(
    currentStatus: string,
    scope: unknown,
    materialHeaderChange: boolean,
): string {
    if (currentStatus === "Approved" && materialHeaderChange && !isPaymentAllocationScope(scope)) {
        return "Submitted";
    }
    return currentStatus;
}
