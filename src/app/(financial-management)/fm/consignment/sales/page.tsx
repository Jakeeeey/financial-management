import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentDocumentWorkspace from "@/modules/financial-management/consignment/operations/ConsignmentDocumentWorkspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentSalesPage() {
  return <ConsignmentPageFrame title="Sales Records"><ConsignmentDocumentWorkspace documentType="SALE" /></ConsignmentPageFrame>;
}
