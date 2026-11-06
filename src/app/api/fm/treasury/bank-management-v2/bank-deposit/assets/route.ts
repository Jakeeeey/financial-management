import { NextResponse } from "next/server";

import { listDepositSlips, listUndepositedAssets, ValidationError } from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/services/deposit.service";
import { DirectusError, listItems } from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/services/directus";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [assets, slips, accounts] = await Promise.all([
      listUndepositedAssets(),
      listDepositSlips(),
      listItems<{ bank_id: number; bank_name: string | null; account_number: string | null }>("bank_accounts", {
        fields: ["bank_id", "bank_name", "account_number"],
        filter: { is_active: { _eq: 1 } },
        limit: 500,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        assets,
        slips,
        accounts: accounts.rows.map((row) => ({
          bankId: Number(row.bank_id),
          label: [row.bank_name, row.account_number].filter(Boolean).join(" · ") || `Account ${row.bank_id}`,
        })),
      },
    });
  } catch (error) {
    console.error("[bank-management-v2] deposit assets failed", error);
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof DirectusError) {
      return NextResponse.json({ success: false, error: "Could not read depositable collections." }, { status: 502 });
    }
    return NextResponse.json({ success: false, error: "Could not load depositable collections." }, { status: 500 });
  }
}
