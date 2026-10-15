import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentStockCountsModule from "@/modules/financial-management/consignment/operations/ConsignmentStockCountsModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentStockCountsPage() {
  return <ConsignmentPageFrame title="Stock Counts"><ConsignmentStockCountsModule /></ConsignmentPageFrame>;
}
