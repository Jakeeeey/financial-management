import { NextResponse } from "next/server";

import {
  describeDormancyError,
  listDormancy,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-dormancy-account-closing/services/dormancy.service";

export const dynamic = "force-dynamic";

/** FSD Table 9 scan: every account with its inactivity months and dormancy class. */
export async function GET() {
  try {
    const data = await listDormancy();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeDormancyError(error, "[bank-management-v2] dormancy scan failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
