import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/taxation/change-log/components/PageShell";
import { ChangeLogModule } from "@/modules/financial-management/taxation/change-log/ChangeLogModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Change Log | Financial Management",
};

export default function ChangeLogPage() {
  return (
    <PageShell title="Change Log">
      <ChangeLogModule />
    </PageShell>
  );
}
