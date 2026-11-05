import { NextResponse } from "next/server";
import { readPettyCash } from "../../../../_spring";
import { voucherListPdf, type VoucherPrintList } from "../../../_print";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id)) return NextResponse.json({ message: "Invalid fund reference." }, { status: 400 });
  const source = await readPettyCash(`disbursement/print-list?fundId=${id}`);
  if (!source.ok) return source;
  const data = await source.json() as VoucherPrintList, headers = new Headers(source.headers);
  headers.set("Content-Type", "application/pdf"); headers.set("Content-Disposition", `inline; filename="${data.fund.docNo.replace(/[^a-zA-Z0-9_-]/g, "_")}-voucher-list.pdf"`); headers.set("Cache-Control", "private, no-store"); headers.set("X-Content-Type-Options", "nosniff"); headers.delete("Content-Length");
  return new NextResponse(Buffer.from(voucherListPdf(data)), { headers });
}
