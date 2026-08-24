import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { DIRECTUS_STATIC_TOKEN, DIRECTUS_URL } from "../../_attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    context: { params: Promise<{ fileId: string }> },
) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token || !decodeJwtPayload(token)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!DIRECTUS_URL || !DIRECTUS_STATIC_TOKEN) {
        return NextResponse.json({ message: "Directus is not configured" }, { status: 500 });
    }

    const { fileId } = await context.params;
    if (!fileId) {
        return NextResponse.json({ message: "File ID is required" }, { status: 400 });
    }

    try {
        const directusResponse = await fetch(`${DIRECTUS_URL}/assets/${encodeURIComponent(fileId)}`, {
            headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` },
            cache: "no-store",
        });

        if (!directusResponse.ok) {
            return NextResponse.json(
                { message: "Validation document unavailable" },
                { status: directusResponse.status },
            );
        }

        const headers = new Headers();
        const contentType = directusResponse.headers.get("content-type");
        const contentDisposition = directusResponse.headers.get("content-disposition");
        if (contentType) headers.set("content-type", contentType);
        if (contentDisposition) headers.set("content-disposition", contentDisposition);
        headers.set("cache-control", "private, no-store");

        return new NextResponse(await directusResponse.arrayBuffer(), { status: 200, headers });
    } catch (error: unknown) {
        console.error("[GET Bank Deposit Validation Document Error]:", error);
        return NextResponse.json(
            { message: "Failed to load validation document" },
            { status: 500 },
        );
    }
}
