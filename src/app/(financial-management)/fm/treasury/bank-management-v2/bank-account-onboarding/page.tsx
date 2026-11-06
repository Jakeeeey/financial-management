import type { Metadata } from "next";

import { OnboardingModule } from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/OnboardingModule";
import { PageShell } from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/components/PageShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bank & Account Onboarding | Financial Management",
};

export default function BankAccountOnboardingPage() {
  return (
    <PageShell title="Bank & Account Onboarding">
      <OnboardingModule />
    </PageShell>
  );
}
