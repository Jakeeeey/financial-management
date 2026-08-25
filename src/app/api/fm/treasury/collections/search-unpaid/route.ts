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

const COOKIE_NAME = "vos_access_token";
const SPRING_TIMEOUT_MS = 10_000;

export async function GET(request: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

  const query = request.nextUrl.searchParams.get("query")?.trim() || "";
  if (!query) return NextResponse.json({items: [], hasMore: false, nextCursor: null});

  const params = new URLSearchParams({query});
  const pouchId = request.nextUrl.searchParams.get("pouchId")?.trim();
  if (pouchId) params.set("currentPouchId", pouchId);
  const limit = request.nextUrl.searchParams.get("limit")?.trim();
  if (limit) params.set("limit", limit);
  const cursor = request.nextUrl.searchParams.get("cursor")?.trim();
  if (cursor) params.set("cursor", cursor);

  const context = createSpringRequestContext(request.headers.get("x-request-id"), SPRING_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${getSpringBaseUrl()}/api/v1/collections/search-unpaid?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Request-Id": context.requestId,
        },
        cache: "no-store",
        signal: context.controller.signal,
      }
    );

    const body = await readResponseBody(response);
    if (!response.ok) {
      return springErrorResponse(
        response.status,
        body,
        `Spring GET Error: ${response.status}`,
        context.requestId
      );
    }

    return NextResponse.json(body, {
      status: response.status,
      headers: {"X-Request-Id": context.requestId},
    });
  } catch (error: unknown) {
    console.error("[BFF search-unpaid Error]:", error);
    if (isAbortError(error)) {
      return dependencyErrorResponse(
        504,
        "UPSTREAM_TIMEOUT",
        "The unpaid-invoice search timed out. Refine the search and try again.",
        context.requestId
      );
    }
    return dependencyErrorResponse(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "The unpaid-invoice search is temporarily unavailable. Please retry.",
      context.requestId
    );
  } finally {
    context.cleanup();
  }
}
