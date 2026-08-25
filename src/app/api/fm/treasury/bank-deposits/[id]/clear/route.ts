import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { deleteDirectusFile, uploadDirectusFile } from "../../_attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REFERENCE_LENGTH = 100;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function isFileEntry(value: FormDataEntryValue | null): value is File {
    return value !== null && typeof value !== "string" && typeof value.arrayBuffer === "function";
}

function parseResponseBody(text: string): Record<string, unknown> {
    if (!text.trim()) return {};

    try {
        const payload = JSON.parse(text) as unknown;
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
            return payload as Record<string, unknown>;
        }
    } catch {
        // Return the upstream text as a normal message below.
    }

    return { message: text };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unable to clear deposit";
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token || !decodeJwtPayload(token)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!/^\d+$/.test(id)) {
        return NextResponse.json({ message: "A valid deposit ID is required" }, { status: 400 });
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ message: "Clear deposit evidence must be submitted as multipart form data" }, { status: 400 });
    }

    const referenceEntries = formData.getAll("depositReference");
    if (referenceEntries.some((entry) => typeof entry !== "string")) {
        return NextResponse.json({ message: "Deposit reference must be text" }, { status: 400 });
    }

    const depositReference = String(referenceEntries[0] || "").trim();
    if (depositReference.length > MAX_REFERENCE_LENGTH) {
        return NextResponse.json(
            { message: `Deposit reference must not exceed ${MAX_REFERENCE_LENGTH} characters` },
            { status: 400 },
        );
    }

    const documentEntries = formData.getAll("validationDocument");
    if (documentEntries.length > 1) {
        return NextResponse.json({ message: "Only one validation document may be uploaded" }, { status: 400 });
    }

    const documentEntry = documentEntries[0] || null;
    const validationDocument = isFileEntry(documentEntry) ? documentEntry : null;

    if (documentEntries.length === 1 && !validationDocument) {
        return NextResponse.json({ message: "Validation document must be an image or PDF file" }, { status: 400 });
    }

    if (validationDocument) {
        const isImage = validationDocument.type.startsWith("image/");
        const isPdf = validationDocument.type === "application/pdf";
        if (!isImage && !isPdf) {
            return NextResponse.json(
                { message: "Unsupported validation document type. Upload an image or PDF." },
                { status: 400 },
            );
        }
        if (validationDocument.size === 0) {
            return NextResponse.json({ message: "Validation document cannot be empty" }, { status: 400 });
        }
        if (validationDocument.size > MAX_FILE_SIZE) {
            return NextResponse.json({ message: "Validation document exceeds the 10 MB limit" }, { status: 400 });
        }
    }

    if (!depositReference && !validationDocument) {
        return NextResponse.json(
            { message: "Enter a deposit reference number or upload a validation document before clearing" },
            { status: 400 },
        );
    }

    let validationDocumentFileId: string | null = null;
    if (validationDocument) {
        try {
            validationDocumentFileId = await uploadDirectusFile(validationDocument);
        } catch (error: unknown) {
            console.error("[Bank Deposit Validation Document Upload Error]:", error);
            return NextResponse.json({ message: errorMessage(error) }, { status: 502 });
        }
    }

    let springResponse: Response;
    try {
        springResponse = await fetch(
            `${process.env.SPRING_API_BASE_URL}/api/v1/treasury/bank-deposits/${id}/clear`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    depositReference: depositReference || null,
                    validationDocumentFileId,
                }),
                cache: "no-store",
            },
        );
    } catch (error: unknown) {
        console.error("[Bank Deposit Clear Upstream Error]:", error);
        // Do not delete the file here: the network failure may have occurred after ERP committed the clear.
        return NextResponse.json({ message: "Unable to reach the ERP server while clearing the deposit" }, { status: 502 });
    }

    const responseText = await springResponse.text();
    const responsePayload = parseResponseBody(responseText);

    if (!springResponse.ok) {
        if (validationDocumentFileId) {
            await deleteDirectusFile(validationDocumentFileId).catch((error: unknown) => {
                console.error("[Bank Deposit Validation Document Cleanup Error]:", error);
            });
        }
        return NextResponse.json(responsePayload, { status: springResponse.status });
    }

    return NextResponse.json({ success: true, ...responsePayload });
}
