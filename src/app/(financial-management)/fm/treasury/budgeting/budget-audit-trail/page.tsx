import BudgetAuditTrailModule from "@/modules/financial-management/treasury/budgeting/budget-audit-trail/BudgetAuditTrailModule";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Budget Audit Trail | VOS Financial Management",
  description: "Track all modifications and transaction history for department budgets.",
};

export default function BudgetAuditTrailPage() {
  return <BudgetAuditTrailModule />;
}
