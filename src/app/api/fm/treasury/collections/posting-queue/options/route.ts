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
} from "../../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_TIMEOUT_MS = 15_000;

export async function GET(request: NextRequest) {
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();

    try {
        const {response, requestId: upstreamRequestId} = await fetchSpringGetWithRetry(
            `${getSpringBaseUrl()}/api/v1/collections/posting-queue/options`,
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
        console.error("[BFF GET Posting Queue Options Exception]", {requestId, error});

        if (isAbortError(error)) {
            return dependencyErrorResponse(
                504,
                "SPRING_TIMEOUT",
                "The posting queue filters took too long to respond. Please retry.",
                requestId,
            );
        }

        return dependencyErrorResponse(
            503,
            "SPRING_UNAVAILABLE",
            "The posting queue filters are temporarily unavailable. Please retry.",
            requestId,
        );
    }
}
