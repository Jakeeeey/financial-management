import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentApprovalsModule from "@/modules/financial-management/consignment/approvals/ConsignmentApprovalsModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentApprovalsPage() {
  return <ConsignmentPageFrame title="Approvals"><ConsignmentApprovalsModule /></ConsignmentPageFrame>;
}
