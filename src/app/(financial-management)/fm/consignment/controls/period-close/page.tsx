import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentPeriodCloseModule from "@/modules/financial-management/consignment/controls/ConsignmentPeriodCloseModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentPeriodClosePage() {
  return <ConsignmentPageFrame title="Period Close"><ConsignmentPeriodCloseModule /></ConsignmentPageFrame>;
}
