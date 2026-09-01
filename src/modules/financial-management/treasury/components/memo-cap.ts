type MemoPayableLine = {
    id?: number;
    referenceNo?: string | null;
    amount?: number | string | null;
    memoOriginalAmount?: number | string | null;
};

function normalizedReference(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export function getPendingMemoUsage(lines: MemoPayableLine[], memoNumber: string) {
    return lines
        .filter((line) => line.id == null && normalizedReference(line.referenceNo) === normalizedReference(memoNumber))
        .reduce((total, line) => total + Math.abs(Number(line.amount) || 0), 0);
}

/**
 * Returns the amount that can still be allocated to one memo line in the
 * current voucher. The API balance includes persisted allocations, so the
 * original amount of this voucher's persisted memo lines is added back before
 * the current in-memory allocations are evaluated.
 */
export function getMemoAvailableAmount(
    remainingAmount: number | string | null | undefined,
    lines: MemoPayableLine[],
    memoNumber: string,
    currentLineIndex?: number,
) {
    const normalizedMemoNumber = normalizedReference(memoNumber);
    const voucherOriginalUsage = lines
        .filter((line) => line.id != null && normalizedReference(line.referenceNo) === normalizedMemoNumber)
        .reduce((total, line) => total + Math.abs(Number(line.memoOriginalAmount) || 0), 0);
    const otherCurrentUsage = lines
        .filter((line, index) => index !== currentLineIndex && normalizedReference(line.referenceNo) === normalizedMemoNumber)
        .reduce((total, line) => total + Math.abs(Number(line.amount) || 0), 0);

    return Math.max(
        0,
        (Number(remainingAmount) || 0) + voucherOriginalUsage - otherCurrentUsage,
    );
}
