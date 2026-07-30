type PayableLineState = {
    id?: number;
    coaId?: number | null;
    divisionId?: number | null;
    referenceNo?: string | null;
    amount?: number | string | null;
    remarks?: string | null;
};

export function isEmptyPayablePlaceholder(line: PayableLineState) {
    return (
        line.id == null &&
        line.coaId == null &&
        line.divisionId == null &&
        !line.referenceNo?.trim() &&
        !line.remarks?.trim() &&
        (Number(line.amount) || 0) === 0
    );
}

export function replaceEmptyPayablePlaceholders<T extends PayableLineState>(
    current: T[],
    imported: T[],
) {
    return [...current.filter((line) => !isEmptyPayablePlaceholder(line)), ...imported];
}
