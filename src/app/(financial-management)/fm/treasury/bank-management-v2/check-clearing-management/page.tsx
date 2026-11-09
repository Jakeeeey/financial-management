import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/treasury/bank-management-v2/check-clearing-management/components/PageShell";
import { CheckModule } from "@/modules/financial-management/treasury/bank-management-v2/check-clearing-management/CheckModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check & Clearing Management | Financial Management",
};

export default function CheckAndClearingV2Page() {
  return (
    <PageShell title="Check & Clearing Management">
      <CheckModule />
    </PageShell>
  );
}
