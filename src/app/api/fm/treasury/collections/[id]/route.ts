import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";
import {randomUUID} from "node:crypto";
import {
    dependencyErrorResponse,
    fetchSpringGetWithRetry,
    getSpringBaseUrl,
    isAbortError,
    readResponseBody,
    springErrorResponse,
} from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_TIMEOUT_MS = 15_000;

const getSpringErrorMessage = (errorText: string, fallback: string) => {
    try {
        const parsed = JSON.parse(errorText) as {detail?: string; message?: string; error?: string};
        return parsed.detail || parsed.message || parsed.error || fallback;
    } catch {
        return errorText || fallback;
    }
};

export async function GET(
    request: NextRequest,
    {params}: {params: Promise<{id: string}>},
) {
    const {id} = await params;
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/${id}`;
    const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();

    try {
        const {response, requestId: upstreamRequestId} = await fetchSpringGetWithRetry(
            targetUrl,
            token,
            requestId,
            SPRING_TIMEOUT_MS,
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

        return NextResponse.json(payload, {headers: {"X-Request-Id": upstreamRequestId}});
    } catch (error: unknown) {
        console.error("[BFF GET Collection Exception]", {id, requestId, error});

        if (isAbortError(error)) {
            return dependencyErrorResponse(
                504,
                "SPRING_TIMEOUT",
                "The collection details service took too long to respond. Please retry.",
                requestId,
            );
        }

        return dependencyErrorResponse(
            503,
            "SPRING_UNAVAILABLE",
            "The collection details service is temporarily unavailable. Please retry.",
            requestId,
        );
    }
}

export async function PUT(
    request: NextRequest,
    {params}: {params: Promise<{id: string}>},
) {
    const {id} = await params;
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const body = await request.json();
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/${id}`;

    try {
        const res = await fetch(targetUrl, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errorText = await res.text();
            return NextResponse.json({
                message: getSpringErrorMessage(errorText, `Update failed: ${res.status}`),
            }, {status: res.status});
        }

        return NextResponse.json({success: true});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({message}, {status: 500});
    }
}
