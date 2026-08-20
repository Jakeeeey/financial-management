import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";

export const getSpringBaseUrl = () =>
    (process.env.SPRING_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");

export const createSpringRequestContext = (
    incomingRequestId: string | null,
    timeoutMs: number,
    parentSignal?: AbortSignal,
) => {
    const controller = new AbortController();
    const requestId = incomingRequestId?.trim() || randomUUID();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortParent = () => controller.abort(parentSignal?.reason);

    if (parentSignal?.aborted) {
        abortParent();
    } else {
        parentSignal?.addEventListener("abort", abortParent, {once: true});
    }

    return {
        controller,
        requestId,
        cleanup: () => {
            clearTimeout(timeout);
            parentSignal?.removeEventListener("abort", abortParent);
        },
    };
};

export const isAbortError = (error: unknown) =>
    error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");

const RETRYABLE_GET_STATUSES = new Set([500, 502, 503, 504]);

const delay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
        reject(signal.reason ?? new DOMException("The request was aborted.", "AbortError"));
        return;
    }

    const timeout = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
    }, milliseconds);
    const abort = () => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
        reject(signal?.reason ?? new DOMException("The request was aborted.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, {once: true});
});

/**
 * Collection reads are safe to retry once when Spring is warming up or returns
 * a transient upstream failure. A fresh timeout controller is created for each
 * attempt so an expired first request cannot cancel the retry.
 */
export const fetchSpringGetWithRetry = async (
    targetUrl: string,
    token: string,
    incomingRequestId: string | null,
    timeoutMs: number,
    parentSignal?: AbortSignal,
) => {
    const requestId = incomingRequestId?.trim() || randomUUID();
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
        const context = createSpringRequestContext(requestId, timeoutMs, parentSignal);

        try {
            const response = await fetch(targetUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "X-Request-Id": requestId,
                },
                cache: "no-store",
                signal: context.controller.signal,
            });

            if (attempt === 1 && RETRYABLE_GET_STATUSES.has(response.status)) {
                await response.text();
                await delay(150, parentSignal);
                continue;
            }

            return {response, requestId};
        } catch (error) {
            lastError = error;
            if (attempt === 2 || isAbortError(error)) throw error;
            await delay(150, parentSignal);
        } finally {
            context.cleanup();
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Spring GET failed.");
};

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
