import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentMySubmissionsModule from "@/modules/financial-management/consignment/operations/ConsignmentMySubmissionsModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentMySubmissionsPage() {
  return <ConsignmentPageFrame title="My Submissions"><ConsignmentMySubmissionsModule /></ConsignmentPageFrame>;
}
