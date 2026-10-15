import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentTrialBalanceModule from "@/modules/financial-management/consignment/reports/ConsignmentTrialBalanceModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentTrialBalancePage() {
  return <ConsignmentPageFrame title="Trial Balance"><ConsignmentTrialBalanceModule /></ConsignmentPageFrame>;
}
