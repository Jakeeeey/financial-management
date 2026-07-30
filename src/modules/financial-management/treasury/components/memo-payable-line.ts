type MemoAwarePayableLine = {
    referenceNo?: string | null;
    memoId?: number;
    isMemo?: boolean;
};

export function normalizeMemoReference(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export function isMemoPayableLine(
    line: MemoAwarePayableLine,
    memoReferences: ReadonlySet<string> = new Set(),
): boolean {
    const reference = normalizeMemoReference(line.referenceNo);
    return line.isMemo === true || line.memoId != null || (reference !== "" && memoReferences.has(reference));
}

export function stripMemoLineMetadata<T extends MemoAwarePayableLine>(line: T): T {
    const persisted = { ...line };
    delete persisted.isMemo;
    delete persisted.memoId;
    delete (persisted as { memoType?: number }).memoType;
    delete (persisted as { memoNumber?: string }).memoNumber;
    return persisted;
}
