import { NextResponse } from "next/server";
import { readPettyCash } from "../../../../_spring";
import { voucherPdf } from "../../../_print";
import type { VoucherOperations } from "@/modules/financial-management/petty-cash/voucher-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id)) return NextResponse.json({ message: "Invalid voucher reference." }, { status: 400 });
  const source = await readPettyCash(`disbursement/vouchers/${id}/workflow`);
  if (!source.ok) return source;
  const data = await source.json() as VoucherOperations, headers = new Headers(source.headers);
  headers.set("Content-Type", "application/pdf"); headers.set("Content-Disposition", `inline; filename="${data.voucher.docNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`); headers.set("Cache-Control", "private, no-store"); headers.set("X-Content-Type-Options", "nosniff"); headers.delete("Content-Length");
  return new NextResponse(Buffer.from(voucherPdf(data)), { headers });
}
