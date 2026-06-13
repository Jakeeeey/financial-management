import { ApiHttpError, readApiResponse } from "../../shared/apiHttp";

function parseUnauthorizedMessage(text: string): string {
    if (!text) return "Unauthorized";

    try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed === "object" && parsed !== null) {
            const record = parsed as Record<string, unknown>;
            if (typeof record.error === "string" && record.error.trim()) return record.error;
            if (typeof record.message === "string" && record.message.trim()) return record.message;
        }
    } catch {
        return text;
    }

    return "Unauthorized";
}

export async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, {
        ...init,
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

    if (res.ok) {
        return (await res.json()) as T;
    }

    const txt = await res.text().catch(() => "");

    if (res.status === 401) {
        throw new ApiHttpError(parseUnauthorizedMessage(txt), 401);
    }

    try {
        const json = JSON.parse(txt) as Record<string, unknown>;
        throw new Error(JSON.stringify(json));
    } catch (error: unknown) {
        if (error instanceof SyntaxError) {
            throw new Error(txt || `Request failed (${res.status})`);
        }
        throw error;
    }
}
