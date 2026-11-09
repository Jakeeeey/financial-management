import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/taxation/payments-2307/components/PageShell";
import { Payments2307Module } from "@/modules/financial-management/taxation/payments-2307/components/Payments2307Module";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payments & 2307 | Financial Management",
  description: "Lock filed periods, record payments per return, and match 2307 certificates against the ledger.",
};

export default function Payments2307Page() {
  return (
    <PageShell title="Payments & 2307">
      <Payments2307Module />
    </PageShell>
  );
}
