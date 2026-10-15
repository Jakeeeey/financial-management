import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentListingFeesModule from "@/modules/financial-management/consignment/operations/ConsignmentListingFeesModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentListingFeesPage() {
  return <ConsignmentPageFrame title="Listing Fees"><ConsignmentListingFeesModule /></ConsignmentPageFrame>;
}
