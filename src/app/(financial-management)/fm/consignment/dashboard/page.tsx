import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentDashboardModule from "@/modules/financial-management/consignment/operations/ConsignmentDashboardModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentDashboardPage() {
  return <ConsignmentPageFrame title="Dashboard"><ConsignmentDashboardModule /></ConsignmentPageFrame>;
}
