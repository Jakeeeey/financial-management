import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/treasury/bank-management-v2/bank-masterlist-audit-logs/components/PageShell";
import { MasterlistModule } from "@/modules/financial-management/treasury/bank-management-v2/bank-masterlist-audit-logs/MasterlistModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bank Masterlist & Audit Logs (ARF) | Financial Management",
};

export default function BankMasterlistV2Page() {
  return (
    <PageShell title="Bank Masterlist & Audit Logs (ARF)">
      <MasterlistModule />
    </PageShell>
  );
}
