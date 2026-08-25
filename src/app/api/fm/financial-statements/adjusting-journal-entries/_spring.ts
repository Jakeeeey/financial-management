import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  REFRESH_PATH,
  getCookieOptions,
  pickTokenFromPayload,
} from "@/lib/auth-utils";

const SPRING_RESOURCE = "/api/financial-statements/adjusting-journal-entries";

export function getSpringBaseUrl() {
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

export function buildSpringSourceJournalPath(jeNo: string) {
  return `${SPRING_RESOURCE}/source-journal-entry/${encodeURIComponent(jeNo)}`;
}

export function buildSpringPostedAdjustmentHistoryPath(jeNo: string, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  const query = params.toString();
  return `${SPRING_RESOURCE}/source-journal-entry/${encodeURIComponent(jeNo)}/posted-adjustments${query ? `?${query}` : ""}`;
}

export function buildSpringSourceJournalSearchPath(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  const query = params.toString();
  return query ? `${SPRING_RESOURCE}/source-journal-entries?${query}` : `${SPRING_RESOURCE}/source-journal-entries`;
}

export function buildSpringSummaryPath(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  const query = params.toString();
  return query ? `${SPRING_RESOURCE}/summary?${query}` : `${SPRING_RESOURCE}/summary`;
}

export function buildSpringSourceTotalsPath() {
  return `${SPRING_RESOURCE}/source-totals`;
}

export function buildSpringPostedTotalsPath() {
  return `${SPRING_RESOURCE}/posted-totals`;
}

type RefreshedToken = {
  accessToken: string;
  refreshToken?: string;
};

async function refreshAccessToken(refreshToken: string): Promise<RefreshedToken | null> {
  const refreshRes = await fetch(`${getSpringBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      Cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!refreshRes.ok) return null;

  const data = await refreshRes.json().catch(() => null) as Record<string, unknown> | null;
  const accessToken = pickTokenFromPayload(data);
  if (!accessToken) return null;

  const setCookies = refreshRes.headers.getSetCookie();
  const refreshCookieStr = setCookies.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`));
  const nextRefreshToken = refreshCookieStr?.split(";")[0]?.split("=")[1];

  return {
    accessToken,
    ...(nextRefreshToken ? { refreshToken: nextRefreshToken } : {}),
  };
}

function attachRefreshedCookies(response: NextResponse, refreshed: RefreshedToken | null) {
  if (!refreshed) return;

  response.cookies.set({
    name: COOKIE_NAME,
    value: refreshed.accessToken,
    ...getCookieOptions(true, "/"),
  });

  if (refreshed.refreshToken) {
    response.cookies.set({
      name: REFRESH_COOKIE_NAME,
      value: refreshed.refreshToken,
      ...getCookieOptions(true, REFRESH_PATH),
    });
  }
}

async function fetchSpring(path: string, token: string, init?: RequestInit) {
  return fetch(`${getSpringBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function proxySpring(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  let token = cookieStore.get(COOKIE_NAME)?.value;
  let refreshed: RefreshedToken | null = null;

  try {
    if (!token && refreshToken) {
      refreshed = await refreshAccessToken(refreshToken);
      token = refreshed?.accessToken;
    }

    if (!token) {
      return NextResponse.json(
        { message: "Your browser did not send the Spring access token. Please sign in again before saving." },
        { status: 401 },
      );
    }

    let springRes = await fetchSpring(path, token, init);

    if (springRes.status === 401 && refreshToken) {
      refreshed = await refreshAccessToken(refreshToken);
      if (refreshed?.accessToken) {
        springRes = await fetchSpring(path, refreshed.accessToken, init);
      }
    }

    const contentType = springRes.headers.get("content-type") || "application/json";
    const text = await springRes.text();

    const response = springRes.status === 401 && !text
      ? NextResponse.json(
        { message: "Spring rejected the current session token. Please sign in again before saving." },
        { status: 401 },
      )
      : new NextResponse(text || null, {
        status: springRes.status,
        headers: text ? { "Content-Type": contentType } : undefined,
      });
    attachRefreshedCookies(response, refreshed);
    return response;
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
