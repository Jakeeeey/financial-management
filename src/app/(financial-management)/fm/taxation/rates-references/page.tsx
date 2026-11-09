import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/taxation/rates-references/components/PageShell";
import { RatesReferencesModule } from "@/modules/financial-management/taxation/rates-references/RatesReferencesModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rates & References | Financial Management",
};

export default function RatesReferencesPage() {
  return (
    <PageShell title="Rates & References">
      <RatesReferencesModule />
    </PageShell>
  );
}
