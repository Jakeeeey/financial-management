import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { buildSpringSourceJournalPath, getSpringBaseUrl } from "../../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchSpringSourceEndpoint(jeNo: string, token: string) {
  const springRes = await fetch(`${getSpringBaseUrl()}${buildSpringSourceJournalPath(jeNo)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await springRes.text();
  const contentType = springRes.headers.get("content-type") || "application/json";

  if (!springRes.ok && springRes.status === 404) {
    return NextResponse.json({ message: "Source journal entry not found" }, { status: 404 });
  }

  return new NextResponse(text || null, {
    status: springRes.status,
    headers: text ? { "Content-Type": contentType } : undefined,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jeNo: string }> },
) {
  const { jeNo } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    if (!token) {
      return NextResponse.json({ message: "Please sign in before loading source journal entries" }, { status: 401 });
    }

    return fetchSpringSourceEndpoint(jeNo, token);
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load source journal entry",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
