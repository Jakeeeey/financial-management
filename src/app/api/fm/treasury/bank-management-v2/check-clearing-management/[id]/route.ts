import { NextResponse } from "next/server";

import {
  describeCheckError,
  getCheckDetail,
} from "@/modules/financial-management/treasury/bank-management-v2/check-clearing-management/services/checks.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const checkId = Number(id);
  if (!Number.isInteger(checkId) || checkId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid check id." }, { status: 400 });
  }

  try {
    const data = await getCheckDetail(checkId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeCheckError(error, `[bank-management-v2] check detail ${checkId} failed`);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
