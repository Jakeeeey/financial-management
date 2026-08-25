import { NextRequest, NextResponse } from "next/server";
import { asNumber, asString, jsonError } from "../_utils";
import { calculateSystemBalance, validateStatementDate } from "../balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bankId = asNumber(searchParams.get("bank_id"));
    const statementDate = asString(searchParams.get("statement_date"));

    if (!bankId) {
      return NextResponse.json(
        { error: "Bank account is required" },
        { status: 400 },
      );
    }
    if (!statementDate) {
      return NextResponse.json(
        { error: "Statement date is required" },
        { status: 400 },
      );
    }
    if (!validateStatementDate(statementDate)) {
      return NextResponse.json(
        { error: "Statement date must use YYYY-MM-DD format" },
        { status: 400 },
      );
    }

    const systemBalance = await calculateSystemBalance(bankId, statementDate);

    return NextResponse.json({
      bankId,
      statementDate,
      systemBalance,
    });
  } catch (error) {
    return jsonError(error);
  }
}
