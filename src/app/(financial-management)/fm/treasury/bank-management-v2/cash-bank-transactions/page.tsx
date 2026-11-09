import type { Metadata } from "next";

import { TransactionsModule } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/TransactionsModule";
import { PageShell } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/components/PageShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cash & Bank Transactions | Financial Management",
};

export default function CashBankTransactionsPage() {
  return (
    <PageShell title="Cash & Bank Transactions">
      <TransactionsModule />
    </PageShell>
  );
}
