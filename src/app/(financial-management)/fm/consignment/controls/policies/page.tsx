import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentAccountingControlsModule from "@/modules/financial-management/consignment/controls/ConsignmentAccountingControlsModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentAccountingControlsPage() {
  return <ConsignmentPageFrame title="Policies & Accounts"><ConsignmentAccountingControlsModule /></ConsignmentPageFrame>;
}
