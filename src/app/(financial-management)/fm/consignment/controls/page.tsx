import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentReconciliationModule from "@/modules/financial-management/consignment/controls/ConsignmentReconciliationModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentReconciliationPage() {
  return <ConsignmentPageFrame title="Reconciliation"><ConsignmentReconciliationModule /></ConsignmentPageFrame>;
}
