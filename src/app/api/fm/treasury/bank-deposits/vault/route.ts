import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_PAGE_SIZE = 200;

type JsonRecord = Record<string, unknown>;

interface SpringVaultAsset {
    detailId?: unknown;
    detail_id?: unknown;
    documentNumber?: unknown;
    document_number?: unknown;
    collectionReference?: unknown;
    collection_reference?: unknown;
    sourcePouchNo?: unknown;
    source_pouch_no?: unknown;
    assetType?: unknown;
    asset_type?: unknown;
    bankName?: unknown;
    bank_name?: unknown;
    bankReferenceValid?: unknown;
    bank_reference_valid?: unknown;
    checkNo?: unknown;
    check_no?: unknown;
    amount?: unknown;
    collectionDate?: unknown;
    collection_date?: unknown;
    chequeDate?: unknown;
    cheque_date?: unknown;
}

interface SpringVaultPage {
    content: SpringVaultAsset[];
    totalPages: number;
}

interface VaultAsset {
    detailId: number;
    documentNumber: string;
    collectionReference: string;
    sourcePouchNo: string;
    assetType: "CASH" | "CHECK";
    bankName: string;
    bankReferenceValid: boolean;
    checkNo: string;
    amount: number;
    collectionDate: string | null;
    chequeDate: string | null;
}

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

const asRecord = (value: unknown): JsonRecord => (
    value && typeof value === "object" ? value as JsonRecord : {}
);

const asString = (value: unknown): string => value == null ? "" : String(value);

const asNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const asDateString = (value: unknown): string | null => {
    const normalized = asString(value).trim();
    return normalized || null;
};

const asBoolean = (value: unknown, fallback = true): boolean => {
    if (value === undefined || value === null) return fallback;
    return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
};

const parsePage = (value: string | null): number => {
    const parsed = Number(value ?? "0");
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const parseSize = (value: string | null): number => {
    const parsed = Number(value ?? "50");
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 200 ? parsed : 50;
};

const normalizeAsset = (raw: SpringVaultAsset): VaultAsset => {
    const assetType = asString(raw.assetType ?? raw.asset_type).toUpperCase() === "CHECK" ? "CHECK" : "CASH";
    const documentNumber = asString(raw.documentNumber ?? raw.document_number ?? raw.sourcePouchNo ?? raw.source_pouch_no);

    return {
        detailId: asNumber(raw.detailId ?? raw.detail_id),
        documentNumber,
        collectionReference: asString(raw.collectionReference ?? raw.collection_reference),
        sourcePouchNo: documentNumber,
        assetType,
        bankName: asString(raw.bankName ?? raw.bank_name),
        bankReferenceValid: assetType === "CASH" || asBoolean(raw.bankReferenceValid ?? raw.bank_reference_valid),
        checkNo: asString(raw.checkNo ?? raw.check_no),
        amount: asNumber(raw.amount),
        collectionDate: asDateString(raw.collectionDate ?? raw.collection_date),
        chequeDate: asDateString(raw.chequeDate ?? raw.cheque_date),
    };
};

const fetchSpringPage = async (
    token: string,
    page: number,
): Promise<SpringVaultPage> => {
    const query = new URLSearchParams({
        page: String(page),
        size: String(UPSTREAM_PAGE_SIZE),
    });
    const response = await fetch(`${getSpringBaseUrl()}/api/v1/treasury/bank-deposits/vault?${query.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Spring GET Error: ${response.status}`);
    }

    const payload = asRecord(await response.json());
    const content = Array.isArray(payload.content) ? payload.content : null;
    const totalPages = Number(payload.totalPages);

    if (!content || !Number.isInteger(totalPages) || totalPages < 0) {
        throw new Error("Spring vault response has an invalid page shape.");
    }

    return {
        content: content as SpringVaultAsset[],
        totalPages,
    };
};

const fetchAllAssets = async (token: string): Promise<VaultAsset[]> => {
    const firstPage = await fetchSpringPage(token, 0);
    const assets = firstPage.content.map(normalizeAsset);

    for (let page = 1; page < firstPage.totalPages; page += 1) {
        const nextPage = await fetchSpringPage(token, page);
        assets.push(...nextPage.content.map(normalizeAsset));
    }

    return assets;
};

const includesNormalized = (value: string, query: string): boolean => (
    value.toLocaleLowerCase().includes(query.toLocaleLowerCase())
);

const isValidDateFilter = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const requestedPage = parsePage(searchParams.get("page"));
    const size = parseSize(searchParams.get("size"));
    const type = (searchParams.get("type") || "ALL").toUpperCase();
    const documentNumber = (searchParams.get("documentNumber") || searchParams.get("search") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();
    const bankName = (searchParams.get("bankName") || "").trim();

    if (type !== "ALL" && type !== "CASH" && type !== "CHECK") {
        return NextResponse.json({ message: "Invalid vault asset type filter." }, { status: 400 });
    }

    if ((dateFrom && !isValidDateFilter(dateFrom)) || (dateTo && !isValidDateFilter(dateTo))) {
        return NextResponse.json({ message: "Date filters must use YYYY-MM-DD format." }, { status: 400 });
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
        return NextResponse.json({ message: "The start date cannot be after the end date." }, { status: 400 });
    }

    try {
        const assets = await fetchAllAssets(token);
        const filteredAssets = assets.filter((asset) => {
            if (type !== "ALL" && asset.assetType !== type) return false;
            if (documentNumber && !includesNormalized(asset.documentNumber, documentNumber)
                && !includesNormalized(asset.collectionReference, documentNumber)
                && !includesNormalized(asset.checkNo, documentNumber)) return false;
            if (dateFrom && (!asset.collectionDate || asset.collectionDate.slice(0, 10) < dateFrom)) return false;
            if (dateTo && (!asset.collectionDate || asset.collectionDate.slice(0, 10) > dateTo)) return false;
            if (bankName && asset.bankName.toLocaleLowerCase() !== bankName.toLocaleLowerCase()) return false;
            return true;
        });

        const bankOptions = [...new Set(
            assets.map((asset) => asset.bankName.trim()).filter(Boolean),
        )].sort((left, right) => left.localeCompare(right));
        const totalElements = filteredAssets.length;
        const totalPages = Math.ceil(totalElements / size);
        const page = totalPages === 0 ? 0 : Math.min(requestedPage, totalPages - 1);
        const start = page * size;

        return NextResponse.json({
            content: filteredAssets.slice(start, start + size),
            totalPages,
            totalElements,
            number: page,
            size,
            bankOptions,
        });
    } catch (err: unknown) {
        console.error("[BFF GET Vault Assets Exception]:", err);
        return NextResponse.json({
            message: "Unable to load bank deposit vault assets.",
            code: "VAULT_ASSET_LOAD_FAILED",
        }, { status: 502 });
    }
}
