import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentStockPositionModule from "@/modules/financial-management/consignment/operations/ConsignmentStockPositionModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentStockPositionPage() {
  return <ConsignmentPageFrame title="Stock Position"><ConsignmentStockPositionModule /></ConsignmentPageFrame>;
}
