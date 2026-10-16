import ConsignmentPageFrame from "@/modules/financial-management/consignment/components/ConsignmentPageFrame";
import ConsignmentBasisOfAccountingModule from "@/modules/financial-management/consignment/operations/ConsignmentBasisOfAccountingModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ConsignmentBasisOfAccountingPage() {
  return <ConsignmentPageFrame title="Basis of Accounting"><ConsignmentBasisOfAccountingModule /></ConsignmentPageFrame>;
}
