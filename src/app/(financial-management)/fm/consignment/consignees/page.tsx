import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentConsigneesModule from "@/modules/financial-management/consignment/operations/ConsignmentConsigneesModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentConsigneesPage() {
  return <ConsignmentPageFrame title="Consignees"><ConsignmentConsigneesModule /></ConsignmentPageFrame>;
}
