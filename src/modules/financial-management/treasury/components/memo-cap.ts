type MemoPayableLine = {
    id?: number;
    referenceNo?: string | null;
    amount?: number | string | null;
};

function normalizedReference(value: string | null | undefined) {
    return value?.trim() || "";
}

export function getPendingMemoUsage(lines: MemoPayableLine[], memoNumber: string) {
    return lines
        .filter((line) => line.id == null && normalizedReference(line.referenceNo) === memoNumber)
        .reduce((total, line) => total + Math.abs(Number(line.amount) || 0), 0);
}
