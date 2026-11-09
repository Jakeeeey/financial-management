import type { Metadata } from "next";

import { PageShell } from "@/modules/financial-management/taxation/vat-withholding/components/PageShell";
import { VatWithholdingModule } from "@/modules/financial-management/taxation/vat-withholding/VatWithholdingModule";

export const metadata: Metadata = {
  title: "VAT & Withholding | Financial Management",
};

export default function VatWithholdingPage() {
  return (
    <PageShell title="VAT & Withholding">
      <VatWithholdingModule />
    </PageShell>
  );
}
