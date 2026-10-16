import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentAgreementsModule from "@/modules/financial-management/consignment/operations/ConsignmentAgreementsModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentAgreementsPage() {
  return <ConsignmentPageFrame title="Agreements"><ConsignmentAgreementsModule /></ConsignmentPageFrame>;
}
