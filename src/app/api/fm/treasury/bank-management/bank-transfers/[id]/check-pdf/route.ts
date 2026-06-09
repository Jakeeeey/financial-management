import { NextResponse } from "next/server";
import {
  CheckPrintError,
  generateBankTransferCheckPdf,
  getCheckPdfFilename,
  getPrintableCheckTransfer,
} from "../../check-pdf";
import { asNumber, jsonError } from "../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const transferId = asNumber(id);
    if (!transferId) {
      return NextResponse.json({ error: "Invalid transfer_id" }, { status: 400 });
    }

    const transfer = await getPrintableCheckTransfer(transferId);
    const pdf = generateBankTransferCheckPdf(transfer);

    return new NextResponse(pdf, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${getCheckPdfFilename(transfer)}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    if (error instanceof CheckPrintError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return jsonError(error);
  }
}
