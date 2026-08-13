import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";
import {
    createSpringRequestContext,
    dependencyErrorResponse,
    getSpringBaseUrl,
    isAbortError,
    readResponseBody,
    springErrorResponse,
} from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_TIMEOUT_MS = 30_000;

export async function POST(request: NextRequest) {
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const context = createSpringRequestContext(request.headers.get("x-request-id"), SPRING_TIMEOUT_MS);

    try {
        const body = await request.json();
        const springRes = await fetch(`${getSpringBaseUrl()}/api/v1/collections/receive`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-Request-Id": context.requestId,
            },
            body: JSON.stringify(body),
            signal: context.controller.signal,
        });

        if (!springRes.ok) {
            return springErrorResponse(
                springRes.status,
                await readResponseBody(springRes),
                `Spring rejected the pouch: ${springRes.status}`,
                context.requestId
            );
        }

        return new Response(await springRes.text(), {
            status: 200,
            headers: {
                "Content-Type": "text/plain",
                "X-Request-Id": context.requestId,
            },
        });
    } catch (error: unknown) {
        console.error("[BFF] POST /api/fm/treasury/collections/receive failed:", error);
        if (isAbortError(error)) {
            return dependencyErrorResponse(
                504,
                "UPSTREAM_TIMEOUT",
                "The collection service timed out. Please retry.",
                context.requestId
            );
        }
        return dependencyErrorResponse(
            503,
            "DEPENDENCY_UNAVAILABLE",
            "The collection service is temporarily unavailable. Please retry.",
            context.requestId
        );
    } finally {
        context.cleanup();
    }
}
