import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentDocumentWorkspace from "@/modules/financial-management/consignment/operations/ConsignmentDocumentWorkspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentMemosPage() {
  return <ConsignmentPageFrame title="Debit / Credit Memos"><ConsignmentDocumentWorkspace documentType="DED" /></ConsignmentPageFrame>;
}
