export type ReviewFlag = "normal" | "high" | "critical";

export interface TrialBalanceAccount {
  id: string;
  code: string;
  title: string;
  branch: string;
  division: string;
  department: string;
  module: string;
  status: string;
  date: string;
  debit: number;
  credit: number;
  balance: number;
  reviewFlag: ReviewFlag;
  accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
}

export interface JournalEntryLine {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  source: string;
  postedBy: string;
}
