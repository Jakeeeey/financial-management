import { redirect } from "next/navigation";
import { bankReconciliationLandingPath, type BankReconciliationSearchParams } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/workspaces";

export default async function Page({ searchParams }: { searchParams: Promise<BankReconciliationSearchParams> }) {
  redirect(bankReconciliationLandingPath(await searchParams));
}
