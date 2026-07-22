type PayableLineLike = {
    referenceNo?: string | null;
    divisionId?: number;
    remarks?: string | null;
};

const VAT_PRINCIPAL_REMARK = "Principal Net of VAT";
const VAT_CHILD_REMARKS = new Set(["Input VAT (12%)", "EWT Deduction (1%)"]);

function normalizedReference(referenceNo: string | null | undefined) {
    return referenceNo?.trim() || "";
}

function isSameReference(left: string | null | undefined, right: string | null | undefined) {
    const leftReference = normalizedReference(left);
    return leftReference !== "" && leftReference === normalizedReference(right);
}

export function isVatPrincipalLine(line: PayableLineLike) {
    return line.remarks?.trim() === VAT_PRINCIPAL_REMARK;
}

export function isVatChildLine(line: PayableLineLike) {
    return VAT_CHILD_REMARKS.has(line.remarks?.trim() || "");
}

export function updateVatSplitDivision<T extends PayableLineLike>(
    lines: T[],
    principalIndex: number,
    divisionId: number | undefined,
) {
    const principal = lines[principalIndex];
    if (!principal || !isVatPrincipalLine(principal)) {
        return lines.map((line, index) => index === principalIndex ? { ...line, divisionId } : line);
    }

    return lines.map((line, index) => {
        const isRelatedSplit = index === principalIndex || (
            isVatChildLine(line) && isSameReference(line.referenceNo, principal.referenceNo)
        );
        return isRelatedSplit ? { ...line, divisionId } : line;
    });
}

export function isInheritedVatSplitLine<T extends PayableLineLike>(lines: T[], index: number) {
    const line = lines[index];
    if (!line || !isVatChildLine(line)) return false;

    return lines.some((candidate, candidateIndex) => (
        candidateIndex !== index &&
        isVatPrincipalLine(candidate) &&
        isSameReference(candidate.referenceNo, line.referenceNo)
    ));
}
