import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/components/PageShell";
import { DepositModule } from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/DepositModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bank Deposit | Financial Management",
};

export default function BankDepositV2Page() {
  return (
    <PageShell title="Bank Deposit">
      <DepositModule />
    </PageShell>
  );
}
