import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/taxation/tax-calendar/components/PageShell";
import { TaxCalendarModule } from "@/modules/financial-management/taxation/tax-calendar/TaxCalendarModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tax Calendar | Financial Management",
};

export default function TaxCalendarPage() {
  return (
    <PageShell title="Tax Calendar">
      <TaxCalendarModule />
    </PageShell>
  );
}
