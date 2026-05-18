export type ReportCategory = "Allocation" | "Summary" | "Analysis" | "Audit";

export interface BudgetReportDef {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  icon: string; // Lucide icon name
}

export const BUDGET_REPORTS: BudgetReportDef[] = [
  {
    id: "allocation",
    title: "Budget Allocation Report",
    description: "Comprehensive overview of budget allocations across all divisions and departments for the selected period.",
    category: "Allocation",
    icon: "PieChart"
  },
  {
    id: "summary",
    title: "Department-wise Budget Summary",
    description: "Detailed breakdown of approved budgets, utilization, and remaining balances by department.",
    category: "Summary",
    icon: "LayoutDashboard"
  },
  {
    id: "account-wise",
    title: "Account-wise Budget Report",
    description: "Analysis of budget distribution and spending patterns across different account codes.",
    category: "Analysis",
    icon: "BarChart3"
  },
  {
    id: "utilization",
    title: "Budget Utilization & Variance Report",
    description: "Track budget utilization rates and identify significant variances from planned allocations.",
    category: "Analysis",
    icon: "Activity"
  },
  {
    id: "revised-history",
    title: "Revised Budget History",
    description: "Complete audit trail of budget revisions including justifications, approvers, and timestamps.",
    category: "Audit",
    icon: "History"
  },
  {
    id: "approval-audit",
    title: "Budget Approval & Audit Report",
    description: "Comprehensive audit log showing budget approval workflow, reviewers, and compliance documentation.",
    category: "Audit",
    icon: "ClipboardCheck"
  }
];
