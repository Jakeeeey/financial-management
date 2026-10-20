import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentAuditTrailModule from "@/modules/financial-management/consignment/controls/ConsignmentAuditTrailModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentAuditTrailPage() {
  return <ConsignmentPageFrame title="Audit Trail"><ConsignmentAuditTrailModule /></ConsignmentPageFrame>;
}
