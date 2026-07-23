type DirectusList<T> = { data?: T[] };

type DirectusMemo = {
    id: number;
    memo_number: string;
    supplier_id?: number | { id?: number } | null;
    type: number;
    amount: number | string | null;
    status?: string | null;
};

type DirectusPayable = {
    reference_no?: string | null;
    amount?: number | string | null;
    disbursement_id?: number | { id?: number } | null;
};

type DirectusDisbursement = {
    id: number;
    status?: string | null;
    payee?: number | { id?: number } | null;
};

export type MemoCapInput = {
    referenceNo?: unknown;
    amount?: unknown;
};

export type SupplierMemoBalance = {
    id: number;
    memoNumber: string;
    supplierId: number;
    type: number;
    amount: number;
    appliedAmount: number;
    remainingAmount: number;
    status: string;
};

export type MemoCapError = {
    memoNumber: string;
    authorizedAmount: number;
    appliedAmount: number;
    requestedAmount: number;
    remainingAmount: number;
    message: string;
};

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";
const ACTIVE_DISBURSEMENT_STATUSES = new Set([
    "Draft",
    "Submitted",
    "Approved",
    "Released",
    "Partially Released",
    "Posted",
]);

function asNumber(value: unknown): number | undefined {
    if (value == null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function relationId(value: unknown): number | undefined {
    if (value && typeof value === "object") {
        return asNumber((value as { id?: unknown }).id);
    }
    return asNumber(value);
}

function roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizedReference(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function looksLikeMemoReference(reference: string): boolean {
    return /^(SCM|SDM)-/i.test(reference);
}

async function directusFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
        throw new Error("Directus memo validation is not configured");
    }

    const response = await fetch(`${DIRECTUS_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        cache: "no-store",
    });

    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
}

function memoBalance(
    memo: DirectusMemo,
    appliedAmount: number,
): SupplierMemoBalance {
    const amount = roundMoney(Math.max(0, asNumber(memo.amount) || 0));
    const normalizedApplied = roundMoney(Math.max(0, appliedAmount));
    const memoStatus = memo.status?.toUpperCase();
    const remainingAmount = memoStatus === "USED" || memoStatus === "CANCELLED"
        ? 0
        : roundMoney(Math.max(0, amount - normalizedApplied));

    return {
        id: Number(memo.id),
        memoNumber: memo.memo_number,
        supplierId: relationId(memo.supplier_id) || 0,
        type: Number(memo.type),
        amount,
        appliedAmount: normalizedApplied,
        remainingAmount,
        status: String(memo.status || "Available"),
    };
}

async function fetchMemosByReferences(references: string[]): Promise<DirectusMemo[]> {
    if (references.length === 0) return [];
    const params = new URLSearchParams();
    params.set("filter[memo_number][_in]", references.join(","));
    params.set("fields", "id,memo_number,supplier_id,type,amount,status");
    params.set("limit", "-1");
    const response = await directusFetch<DirectusList<DirectusMemo>>(`/items/suppliers_memo?${params.toString()}`);
    return response.data || [];
}

async function fetchMemosForSupplier(supplierId: number): Promise<DirectusMemo[]> {
    const params = new URLSearchParams();
    params.set("filter[supplier_id][_eq]", String(supplierId));
    params.set("filter[status][_neq]", "CANCELLED");
    params.set("fields", "id,memo_number,supplier_id,type,amount,status");
    params.set("sort", "-date");
    params.set("limit", "-1");
    const response = await directusFetch<DirectusList<DirectusMemo>>(`/items/suppliers_memo?${params.toString()}`);
    return response.data || [];
}

async function fetchAppliedAmounts(
    references: string[],
    excludeDisbursementId?: number,
): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    if (references.length === 0) return totals;

    const payableParams = new URLSearchParams();
    payableParams.set("filter[reference_no][_in]", references.join(","));
    payableParams.set("fields", "reference_no,amount,disbursement_id");
    payableParams.set("limit", "-1");
    const payableResponse = await directusFetch<DirectusList<DirectusPayable>>(
        `/items/disbursement_payables?${payableParams.toString()}`,
    );
    const payableRows = payableResponse.data || [];

    const disbursementIds = Array.from(new Set(
        payableRows
            .map((row) => relationId(row.disbursement_id))
            .filter((id): id is number => Boolean(id) && id !== excludeDisbursementId),
    ));

    const disbursements = disbursementIds.length > 0
        ? (await directusFetch<DirectusList<DirectusDisbursement>>(
            `/items/disbursement?filter[id][_in]=${disbursementIds.join(",")}&fields=id,status,payee&limit=-1`,
        )).data || []
        : [];
    const activeIds = new Set(
        disbursements
            .filter((row) => ACTIVE_DISBURSEMENT_STATUSES.has(String(row.status || "")))
            .map((row) => Number(row.id)),
    );

    for (const row of payableRows) {
        const reference = normalizedReference(row.reference_no);
        const disbursementId = relationId(row.disbursement_id);
        if (!reference || !disbursementId || disbursementId === excludeDisbursementId || !activeIds.has(disbursementId)) {
            continue;
        }
        const amount = Math.abs(asNumber(row.amount) || 0);
        totals.set(reference, roundMoney((totals.get(reference) || 0) + amount));
    }

    return totals;
}

export async function getSupplierMemoBalances(supplierId: number): Promise<SupplierMemoBalance[]> {
    const memos = await fetchMemosForSupplier(supplierId);
    const references = memos.map((memo) => memo.memo_number).filter(Boolean);
    const appliedAmounts = await fetchAppliedAmounts(references);
    return memos.map((memo) => memoBalance(memo, appliedAmounts.get(memo.memo_number) || 0));
}

export async function validateSupplierMemoCaps(
    supplierId: number,
    lines: MemoCapInput[],
    excludeDisbursementId?: number,
): Promise<MemoCapError | null> {
    const requested = new Map<string, number>();
    for (const line of lines) {
        const reference = normalizedReference(line.referenceNo);
        if (!reference) continue;
        const amount = asNumber(line.amount);
        if (amount === undefined || amount === 0) continue;
        requested.set(reference, roundMoney((requested.get(reference) || 0) + Math.abs(amount)));
    }

    const references = Array.from(requested.keys());
    const memoReferences = references.filter(looksLikeMemoReference);
    if (memoReferences.length === 0) return null;

    const memos = await fetchMemosByReferences(memoReferences);
    const memoMap = new Map(memos.map((memo) => [memo.memo_number, memo]));
    const missing = memoReferences.find((reference) => !memoMap.has(reference));
    if (missing) {
        return {
            memoNumber: missing,
            authorizedAmount: 0,
            appliedAmount: 0,
            requestedAmount: requested.get(missing) || 0,
            remainingAmount: 0,
            message: `Supplier memo ${missing} was not found or is not available.`,
        };
    }

    const appliedAmounts = await fetchAppliedAmounts(memoReferences, excludeDisbursementId);
    for (const reference of memoReferences) {
        const memo = memoMap.get(reference);
        if (!memo) continue;
        const memoSupplierId = relationId(memo.supplier_id);
        const requestedAmount = requested.get(reference) || 0;
        const appliedAmount = appliedAmounts.get(reference) || 0;
        const balance = memoBalance(memo, appliedAmount);

        if (memoSupplierId !== supplierId) {
            return {
                memoNumber: reference,
                authorizedAmount: balance.amount,
                appliedAmount,
                requestedAmount,
                remainingAmount: balance.remainingAmount,
                message: `Supplier memo ${reference} does not belong to this supplier.`,
            };
        }

        const matchingLines = lines.filter((line) => normalizedReference(line.referenceNo) === reference);
        const expectedSign = Number(memo.type) === 1 ? -1 : 1;
        const hasWrongDirection = matchingLines.some((line) => {
            const amount = asNumber(line.amount);
            return amount !== undefined && amount !== 0 && Math.sign(amount) !== expectedSign;
        });
        if (hasWrongDirection) {
            return {
                memoNumber: reference,
                authorizedAmount: balance.amount,
                appliedAmount,
                requestedAmount,
                remainingAmount: balance.remainingAmount,
                message: `${reference} must be applied as a ${expectedSign < 0 ? "credit" : "debit"} amount.`,
            };
        }

        if (requestedAmount > balance.remainingAmount + 0.01) {
            return {
                memoNumber: reference,
                authorizedAmount: balance.amount,
                appliedAmount,
                requestedAmount,
                remainingAmount: balance.remainingAmount,
                message: `${reference} exceeds its remaining authorized amount. Requested ${requestedAmount.toFixed(2)}, remaining ${balance.remainingAmount.toFixed(2)}.`,
            };
        }
    }

    return null;
}

export async function refreshSupplierMemoStatuses(
    supplierId: number,
    references: string[],
): Promise<void> {
    const uniqueReferences = Array.from(new Set(references.map(normalizedReference).filter(Boolean)));
    if (uniqueReferences.length === 0) return;

    const [memos, appliedAmounts] = await Promise.all([
        fetchMemosByReferences(uniqueReferences),
        fetchAppliedAmounts(uniqueReferences),
    ]);

    await Promise.all(memos
        .filter((memo) => relationId(memo.supplier_id) === supplierId && String(memo.status || "").toUpperCase() !== "CANCELLED")
        .map(async (memo) => {
            const balance = memoBalance(memo, appliedAmounts.get(memo.memo_number) || 0);
            const nextStatus = balance.remainingAmount <= 0.01 ? "USED" : "Available";
            if (String(memo.status || "") === nextStatus) return;
            await directusFetch(`/items/suppliers_memo/${memo.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: nextStatus }),
            });
        }));
}
