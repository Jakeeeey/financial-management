function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function extractErrorMessage(parsed: unknown, fallback: string): string {
    if (!isRecord(parsed)) return fallback;

    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    if (typeof parsed.details === "string" && parsed.details.trim()) return parsed.details;

    return fallback;
}

export class ApiHttpError extends Error {
    readonly status: number;
    readonly payload: unknown;

    constructor(message: string, status: number, payload?: unknown) {
        super(message);
        this.name = "ApiHttpError";
        this.status = status;
        this.payload = payload;
    }
}

export function isUnauthorizedError(error: unknown): boolean {
    return error instanceof ApiHttpError && error.status === 401;
}

export function isAccessDeniedError(error: unknown): boolean {
    return error instanceof ApiHttpError && error.status === 403;
}

export async function readApiResponse<T>(res: Response): Promise<T> {
    const text = await res.text().catch(() => "");

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        let payload: unknown;

        if (text) {
            const trimmed = text.trimStart();
            if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) {
                message = `Request failed (${res.status}): API route was not found`;
            } else {
                try {
                    payload = JSON.parse(text);
                    message = extractErrorMessage(payload, message);
                } catch {
                    message = text;
                }
            }
        }

        throw new ApiHttpError(message, res.status, payload);
    }

    return text ? (JSON.parse(text) as T) : ({} as T);
}
