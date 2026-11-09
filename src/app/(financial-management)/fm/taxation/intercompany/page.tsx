import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/taxation/intercompany/components/PageShell";
import { IntercompanyModule } from "@/modules/financial-management/taxation/intercompany/IntercompanyModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intercompany Ledger | Financial Management",
  description: "Withholding and intra-group flows derived by matching invoices and purchase orders across companies.",
};

export default function IntercompanyPage() {
  return (
    <PageShell title="Intercompany Ledger">
      <IntercompanyModule />
    </PageShell>
  );
}
