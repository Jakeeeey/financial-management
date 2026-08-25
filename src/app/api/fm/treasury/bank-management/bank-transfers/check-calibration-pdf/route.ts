import { NextResponse } from "next/server";
import { generateBankTransferCheckCalibrationPdf } from "../check-pdf";
import { jsonError } from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pdf = generateBankTransferCheckCalibrationPdf();

    return new NextResponse(pdf, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="bank-transfer-check-calibration.pdf"',
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
