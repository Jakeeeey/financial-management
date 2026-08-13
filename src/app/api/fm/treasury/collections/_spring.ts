import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";

export const getSpringBaseUrl = () =>
    (process.env.SPRING_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");

export const createSpringRequestContext = (incomingRequestId: string | null, timeoutMs: number) => {
    const controller = new AbortController();
    const requestId = incomingRequestId?.trim() || randomUUID();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    return {
        controller,
        requestId,
        cleanup: () => clearTimeout(timeout),
    };
};

export const isAbortError = (error: unknown) =>
    error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");

const asRecord = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === "object" ? value as Record<string, unknown> : {};

export const readResponseBody = async (response: Response): Promise<unknown> => {
    const rawBody = await response.text();
    if (!rawBody) return {};

    try {
        return JSON.parse(rawBody) as unknown;
    } catch {
        return rawBody;
    }
};

export const springErrorResponse = (
    status: number,
    payload: unknown,
    fallback: string,
    requestId: string
) => {
    const body = asRecord(payload);
    const message = typeof body.message === "string"
        ? body.message
        : typeof body.detail === "string"
            ? body.detail
            : typeof body.error === "string"
                ? body.error
                : fallback;
    const error = typeof body.error === "string" ? body.error : `SPRING_${status}`;
    const responseRequestId = typeof body.requestId === "string" ? body.requestId : requestId;

    return NextResponse.json(
        {error, message, requestId: responseRequestId},
        {status, headers: {"X-Request-Id": responseRequestId}}
    );
};

export const dependencyErrorResponse = (
    status: 503 | 504,
    error: string,
    message: string,
    requestId: string
) => NextResponse.json(
    {error, message, requestId},
    {status, headers: {"X-Request-Id": requestId}}
);
