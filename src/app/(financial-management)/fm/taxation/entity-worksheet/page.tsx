import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/taxation/entity-worksheet/components/PageShell";
import { EntityWorksheetModule } from "@/modules/financial-management/taxation/entity-worksheet/EntityWorksheetModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entity Worksheet | Financial Management",
  description: "Quarterly Philippine income tax worksheet built from the company's own ledgers.",
};

export default function EntityWorksheetPage() {
  return (
    <PageShell title="Entity Worksheet">
      <EntityWorksheetModule />
    </PageShell>
  );
}
