import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/treasury/bank-management-v2/bank-dormancy-account-closing/components/PageShell";
import { DormancyModule } from "@/modules/financial-management/treasury/bank-management-v2/bank-dormancy-account-closing/DormancyModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dormancy & Account Closing | Financial Management",
};

export default function DormancyAccountClosingPage() {
  return (
    <PageShell title="Dormancy & Account Closing">
      <DormancyModule />
    </PageShell>
  );
}
