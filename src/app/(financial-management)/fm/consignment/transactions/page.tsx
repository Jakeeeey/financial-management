import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentTransactionsModule from "@/modules/financial-management/consignment/operations/ConsignmentTransactionsModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentTransactionsPage() {
  return <ConsignmentPageFrame title="Transactions"><ConsignmentTransactionsModule /></ConsignmentPageFrame>;
}
