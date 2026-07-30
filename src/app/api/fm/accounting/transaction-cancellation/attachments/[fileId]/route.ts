import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import {
  CANCELLATION_ATTACHMENTS_COLLECTION,
  DIRECTUS_STATIC_TOKEN,
  DIRECTUS_URL,
  directusFetch,
} from "../../_attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DirectusListResponse<T> {
  data?: T[];
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  decodeJwtPayload(token);

  if (!DIRECTUS_URL || !DIRECTUS_STATIC_TOKEN) {
    return NextResponse.json({ message: "Directus is not configured" }, { status: 500 });
  }

  const { fileId } = await context.params;
  if (!fileId) return NextResponse.json({ message: "File ID is required" }, { status: 400 });

  try {
    const attachment = await directusFetch<DirectusListResponse<{ id: string | number }>>(
      `/items/${CANCELLATION_ATTACHMENTS_COLLECTION}?filter[file_id][_eq]=${encodeURIComponent(fileId)}&fields=id&limit=1`
    );
    if (!attachment.data?.length) return NextResponse.json({ message: "Attachment not found" }, { status: 404 });

    const directusResponse = await fetch(`${DIRECTUS_URL}/assets/${encodeURIComponent(fileId)}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` },
      cache: "no-store",
    });
    if (!directusResponse.ok) return NextResponse.json({ message: "Attachment file unavailable" }, { status: directusResponse.status });

    const headers = new Headers();
    const contentType = directusResponse.headers.get("content-type");
    const contentDisposition = directusResponse.headers.get("content-disposition");
    if (contentType) headers.set("content-type", contentType);
    if (contentDisposition) headers.set("content-disposition", contentDisposition);
    return new NextResponse(await directusResponse.arrayBuffer(), { status: 200, headers });
  } catch (error: unknown) {
    console.error("[GET Transaction Cancellation Attachment Error]:", error);
    return NextResponse.json(
      { message: "Failed to load attachment", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

