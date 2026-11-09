import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/taxation/group-overview/components/PageShell";
import { GroupOverviewModule } from "@/modules/financial-management/taxation/group-overview/GroupOverviewModule";
import { TAX_YEARS } from "@/modules/financial-management/taxation/group-overview/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Group Overview | Financial Management",
  description: "Group-wide income tax, VAT, withholding and carryover position for one tax year.",
};

function defaultYear() {
  const current = new Date().getFullYear();
  const years = TAX_YEARS as readonly number[];
  return years.includes(current) ? current : years[years.length - 1];
}

export default function GroupOverviewPage() {
  return (
    <PageShell title="Group Overview">
      <GroupOverviewModule initialYear={defaultYear()} />
    </PageShell>
  );
}
