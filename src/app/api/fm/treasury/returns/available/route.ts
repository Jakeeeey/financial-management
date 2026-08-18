import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {randomUUID} from "node:crypto";
import {
    dependencyErrorResponse,
    fetchSpringGetWithRetry,
    getSpringBaseUrl,
    isAbortError,
    readResponseBody,
    springErrorResponse,
} from "../../collections/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_TIMEOUT_MS = 15_000;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_CUSTOMER_CODES = 50;
const MAX_CUSTOMER_CODE_LENGTH = 50;
const MAX_CUSTOMER_NAMES = 50;
const MAX_CUSTOMER_NAME_LENGTH = 120;

interface RawReturnItem {
    id?: number;
    returnNumber?: string;
    totalAmount?: number;
    availableAmount?: number;
    isApplied?: boolean;
    customerCode?: string;
    customerName?: string;
}

interface PaginatedRawReturnResponse {
    content?: RawReturnItem[];
    totalElements?: number;
    totalPages?: number;
    currentPage?: number;
    size?: number;
    hasMore?: boolean;
}

const asPositiveInteger = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const isPositiveInteger = (value: string | null) =>
    Boolean(value && /^\d+$/.test(value) && Number(value) > 0);

const buildSpringQuery = (request: NextRequest) => {
    const source = request.nextUrl.searchParams;
    const query = new URLSearchParams();
    const rawSalesmanId = source.get("salesmanId")?.trim();
    const rawCustomerCodes = source.get("customerCodes")?.trim();
    const rawCustomerNames = source.get("customerNames")?.trim();

    if (rawSalesmanId && /^\d+$/.test(rawSalesmanId) && Number(rawSalesmanId) > 0) {
        query.set("salesmanId", rawSalesmanId);
    }

    if (rawCustomerCodes) {
        const codes = rawCustomerCodes
            .split(/[|,]/)
            .map(code => code.trim().toUpperCase())
            .filter(Boolean);

        if (codes.length > MAX_CUSTOMER_CODES || codes.some(code => code.length > MAX_CUSTOMER_CODE_LENGTH)) {
            throw new Error("Too many customer codes were supplied.");
        }

        query.set("customerCodes", codes.join("|"));
    }

    if (rawCustomerNames) {
        const names = rawCustomerNames
            .split(/[|,]/)
            .map(name => name.trim())
            .filter(Boolean);

        if (names.length > MAX_CUSTOMER_NAMES || names.some(name => name.length > MAX_CUSTOMER_NAME_LENGTH)) {
            throw new Error("Too many customer names were supplied.");
        }

        query.set("customerNames", names.join("|"));
    }

    const rawPouchId = source.get("currentPouchId")?.trim() || null;
    if (!rawPouchId || !isPositiveInteger(rawPouchId)) {
        throw new Error("A valid currentPouchId is required.");
    }
    query.set("currentPouchId", rawPouchId);

    query.set("page", String(asPositiveInteger(source.get("page"), 1)));
    query.set("size", String(Math.min(asPositiveInteger(source.get("size"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)));
    return query;
};

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
    const source = request.nextUrl.searchParams;
    const salesmanId = source.get("salesmanId")?.trim();
    const customerCodes = source.get("customerCodes")?.trim();
    const customerNames = source.get("customerNames")?.trim();
    const currentPouchId = source.get("currentPouchId")?.trim() || null;

    if (!salesmanId && !customerCodes && !customerNames) {
        return NextResponse.json({ message: "Missing salesmanId, customerCodes, or customerNames" }, { status: 400 });
    }

    if (!isPositiveInteger(currentPouchId)) {
        return NextResponse.json({ message: "A valid currentPouchId is required." }, { status: 400 });
    }

    try {
        const query = buildSpringQuery(request);
        const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/returns/available?${query.toString()}`;
        const {response, requestId: upstreamRequestId} = await fetchSpringGetWithRetry(
            targetUrl,
            token,
            requestId,
            SPRING_TIMEOUT_MS,
            request.signal,
        );
        const payload = await readResponseBody(response);

        if (!response.ok) {
            return springErrorResponse(
                response.status,
                payload,
                `Spring GET Error: ${response.status}`,
                upstreamRequestId,
            );
        }

        const data = (payload || {}) as PaginatedRawReturnResponse;
        const legacyContent = Array.isArray(payload) ? payload as RawReturnItem[] : undefined;
        return NextResponse.json({
            content: legacyContent || data.content || [],
            totalElements: legacyContent ? legacyContent.length : data.totalElements || 0,
            totalPages: legacyContent ? (legacyContent.length > 0 ? 1 : 0) : data.totalPages || 0,
            currentPage: legacyContent ? 1 : data.currentPage || 1,
            size: legacyContent ? legacyContent.length : data.size || DEFAULT_PAGE_SIZE,
            hasMore: legacyContent
                ? false
                : data.hasMore ?? ((data.currentPage || 1) < (data.totalPages || 0)),
        }, {headers: {"X-Request-Id": upstreamRequestId}});
    } catch (error: unknown) {
        if (isAbortError(error)) {
            return dependencyErrorResponse(
                504,
                "SPRING_TIMEOUT",
                "Available returns took too long to respond. Please retry.",
                requestId,
            );
        }

        if (error instanceof Error && (error.message === "Too many customer codes were supplied."
            || error.message === "Too many customer names were supplied."
            || error.message === "A valid currentPouchId is required.")) {
            return NextResponse.json({message: error.message}, {status: 400});
        }

        console.error("[BFF GET Available Returns Exception]", {requestId, error});
        return dependencyErrorResponse(
            503,
            "SPRING_UNAVAILABLE",
            "Available returns are temporarily unavailable. Please retry.",
            requestId,
        );
    }
}
