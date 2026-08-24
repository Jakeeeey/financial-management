export type DisbursementTransactionType = 1 | 2;
export type DocumentPrefix = "TR" | "NT";

type DirectusList<T> = {
    data?: T[];
};

type DirectusFetch = <T>(path: string, options?: RequestInit) => Promise<T>;

type DirectusDisbursementNo = {
    trade_no?: number | string | null;
    "non-trade_no"?: number | string | null;
};

type DocumentNumberRow = {
    doc_no?: unknown;
};

const MAX_ALLOCATION_ATTEMPTS = 16;

const lockState = globalThis as typeof globalThis & {
    __vosDisbursementDocumentNumberLocks?: Map<DocumentPrefix, Promise<void>>;
};

const documentNumberLocks = lockState.__vosDisbursementDocumentNumberLocks
    ?? (lockState.__vosDisbursementDocumentNumberLocks = new Map());

export function documentPrefixForTransactionType(transactionTypeId: DisbursementTransactionType): DocumentPrefix {
    return transactionTypeId === 1 ? "TR" : "NT";
}

function sequenceFieldForPrefix(prefix: DocumentPrefix): keyof DirectusDisbursementNo {
    return prefix === "TR" ? "trade_no" : "non-trade_no";
}

function parseDocumentNumber(value: unknown, prefix: DocumentPrefix): number | null {
    const match = String(value ?? "").trim().toUpperCase().match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) return null;

    const parsed = Number.parseInt(match[1], 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function formatDocumentNumber(prefix: DocumentPrefix, value: number): string {
    return `${prefix}-${String(value).padStart(6, "0")}`;
}

function errorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== "object") return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : JSON.stringify(error);
}

export function isDocumentNumberConflictError(error: unknown): boolean {
    const message = errorMessage(error);
    if (errorStatus(error) === 409) return true;

    return /(duplicate|unique|already exists|conflict)/i.test(message)
        && /(doc[_\s-]?no|document\s+number|disbursement)/i.test(message);
}

export async function acquireDocumentNumberLock(
    transactionTypeId: DisbursementTransactionType,
): Promise<() => void> {
    const prefix = documentPrefixForTransactionType(transactionTypeId);
    const previous = documentNumberLocks.get(prefix) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
        releaseCurrent = resolve;
    });
    const tail = previous.then(() => current);
    documentNumberLocks.set(prefix, tail);

    await previous;

    let released = false;
    return () => {
        if (released) return;
        released = true;
        releaseCurrent();
        if (documentNumberLocks.get(prefix) === tail) {
            documentNumberLocks.delete(prefix);
        }
    };
}

export async function findNextAvailableDocumentNumber(
    transactionTypeId: DisbursementTransactionType,
    directusFetch: DirectusFetch,
): Promise<string> {
    const prefix = documentPrefixForTransactionType(transactionTypeId);
    const sequenceField = sequenceFieldForPrefix(prefix);
    let highestNumber = 0;

    try {
        const sequenceResponse = await directusFetch<DirectusList<DirectusDisbursementNo>>(
            "/items/disbursement_no?limit=1",
        );
        const sequenceValue = sequenceResponse.data?.[0]?.[sequenceField];
        const parsedSequence = Number(sequenceValue);
        if (Number.isSafeInteger(parsedSequence)) highestNumber = parsedSequence;
    } catch {
        // The persisted disbursement numbers remain the fallback sequence source.
    }

    const params = new URLSearchParams();
    params.set("filter[doc_no][_starts_with]", `${prefix}-`);
    params.set("fields", "doc_no");
    params.set("limit", "-1");

    const persistedResponse = await directusFetch<DirectusList<DocumentNumberRow>>(
        `/items/disbursement?${params.toString()}`,
    );
    for (const row of persistedResponse.data ?? []) {
        const parsed = parseDocumentNumber(row.doc_no, prefix);
        if (parsed != null) highestNumber = Math.max(highestNumber, parsed);
    }

    for (let offset = 1; offset <= MAX_ALLOCATION_ATTEMPTS; offset++) {
        const candidate = formatDocumentNumber(prefix, highestNumber + offset);
        const exactParams = new URLSearchParams();
        exactParams.set("filter[doc_no][_eq]", candidate);
        exactParams.set("fields", "id");
        exactParams.set("limit", "1");

        const exactResponse = await directusFetch<DirectusList<{ id?: unknown }>>(
            `/items/disbursement?${exactParams.toString()}`,
        );
        if ((exactResponse.data ?? []).length === 0) return candidate;
    }

    throw new Error(`Could not allocate an unused ${prefix} document number.`);
}
