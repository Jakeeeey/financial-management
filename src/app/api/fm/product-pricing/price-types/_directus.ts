import { NextResponse } from "next/server";

type DirectusErrorItem = {
    message?: string;
    extensions?: { code?: string };
};

type DirectusErrorPayload = {
    errors?: DirectusErrorItem[];
    error?: string;
    message?: string;
};

export class PriceTypeDirectusError extends Error {
    constructor(
        readonly status: number,
        readonly payload: unknown,
        readonly directusCode: string | null,
        message: string,
    ) {
        super(message);
        this.name = "PriceTypeDirectusError";
    }
}

function errorDetails(text: string): { payload: unknown; code: string | null; message: string } {
    try {
        const payload = JSON.parse(text) as DirectusErrorPayload;
        const first = Array.isArray(payload.errors) ? payload.errors[0] : undefined;
        return {
            payload,
            code: first?.extensions?.code ?? null,
            message: first?.message ?? payload.message ?? payload.error ?? "Directus request failed.",
        };
    } catch {
        return { payload: null, code: null, message: text.trim() || "Directus request failed." };
    }
}

export async function fetchPriceTypeDirectus<T>(url: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    const token = process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN;

    if (init?.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, { cache: "no-store", ...init, headers });
    const text = await response.text().catch(() => "");

    if (!response.ok) {
        const details = errorDetails(text);
        throw new PriceTypeDirectusError(response.status, details.payload, details.code, details.message);
    }

    return text.trim() ? (JSON.parse(text) as T) : ({} as T);
}

function isForeignKeyConflict(error: PriceTypeDirectusError): boolean {
    const code = String(error.directusCode ?? "").toUpperCase();
    if (["RESTRICT_VIOLATION", "FOREIGN_KEY_CONSTRAINT", "ER_ROW_IS_REFERENCED_2", "SQLITE_CONSTRAINT_FOREIGNKEY"].includes(code)) {
        return true;
    }

    return /foreign key constraint|cannot delete or update a parent row|constraint fails|delete.*restricted/i.test(error.message);
}

export function priceTypeErrorResponse(error: unknown) {
    if (error instanceof PriceTypeDirectusError) {
        if (isForeignKeyConflict(error)) {
            return NextResponse.json(
                {
                    error: "This price type is linked to existing records. Deactivate it to preserve transaction history.",
                    code: "PRICE_TYPE_IN_USE",
                    canDeactivate: true,
                },
                { status: 409 },
            );
        }

        if (error.status === 401 || error.status === 403) {
            console.error("Price type Directus authorization failed", {
                status: error.status,
                code: error.directusCode,
                message: error.message,
            });
            return NextResponse.json(
                { error: "The Directus service account is not authorized to manage price types.", code: "DIRECTUS_ACCESS_DENIED" },
                { status: 502 },
            );
        }

        if (error.status === 404) {
            return NextResponse.json({ error: "Price type was not found.", code: "PRICE_TYPE_NOT_FOUND" }, { status: 404 });
        }

        if (error.status >= 400 && error.status < 500) {
            return NextResponse.json({ error: error.message, code: error.directusCode ?? "DIRECTUS_VALIDATION_ERROR" }, { status: error.status });
        }

        console.error("Price type Directus request failed", {
            status: error.status,
            code: error.directusCode,
            message: error.message,
        });
        return NextResponse.json({ error: "Price type request failed. Please try again or contact support." }, { status: 502 });
    }

    console.error("Price type request failed", error);
    return NextResponse.json({ error: "Price type request failed. Please try again or contact support." }, { status: 500 });
}
