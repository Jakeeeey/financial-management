import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SPRING_RESOURCE = "/api/financial-statements/adjusting-journal-entries";

function getSpringBaseUrl() {
  return (process.env.SPRING_API_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
}

export function buildSpringListPath(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  const pageSize = params.get("pageSize");
  if (pageSize) {
    params.set("size", pageSize);
    params.delete("pageSize");
  }

  const query = params.toString();
  return query ? `${SPRING_RESOURCE}?${query}` : SPRING_RESOURCE;
}

export function buildSpringItemPath(id: string, action?: "post" | "void") {
  const encoded = encodeURIComponent(id);
  return action ? `${SPRING_RESOURCE}/${encoded}/${action}` : `${SPRING_RESOURCE}/${encoded}`;
}

export async function proxySpring(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const springRes = await fetch(`${getSpringBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    const contentType = springRes.headers.get("content-type") || "application/json";
    const text = await springRes.text();

    return new NextResponse(text || null, {
      status: springRes.status,
      headers: text ? { "Content-Type": contentType } : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "BFF Error",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
