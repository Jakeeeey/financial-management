import { NextResponse } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { buildTransactionTemplate } from "@/modules/financial-management/treasury/bank-reconciliation/services/transactionExcel";
import { IMPORT_LAYOUTS, type TransactionSide } from "@/modules/financial-management/treasury/bank-reconciliation/transaction-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ side: string }> }) {
  const { side } = await params;
  if (side !== "BANK" && side !== "LEDGER") return NextResponse.json({ message: "Unknown template side." }, { status: 404 });
  const session = await proxySpring("/api/v1/treasury/bank-reconciliation/master-options");
  if (!session.ok) return session;
  let response: NextResponse;
  try {
    response = new NextResponse(await buildTransactionTemplate(side as TransactionSide), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${IMPORT_LAYOUTS[side].filename}"` } });
  } catch { response = NextResponse.json({ message: "Unable to generate the template. Please retry." }, { status: 503 }); }
  response.headers.set("Cache-Control", "no-store");
  for (const cookie of session.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
  return response;
}
