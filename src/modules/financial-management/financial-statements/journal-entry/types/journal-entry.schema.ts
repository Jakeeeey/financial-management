import { z } from "zod";

export const JournalEntrySchema = z.object({
  jeGroupCounter: z.number(),
  jeNo: z.string(),
  sourceModule: z.string(),
  transactionRef: z.string(),
  transactionDate: z.string(),
  description: z.string(),
  status: z.string(),
  division: z.string().nullable().default(null),
  department: z.string().nullable().default(null),
  creator: z.string().nullable().default(null),
  coaId: z.number(),
  accountTitle: z.string(),
  debit: z.number(),
  credit: z.number(),
});

export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const JournalEntryListSchema = z.array(JournalEntrySchema);

// Frontend-only types for grouping and analytics
export interface JournalEntryGroup {
  jeGroupCounter: number;
  jeNo: string;
  transactionDate: string;
  sourceModule: string;
  description: string;
  status: string;
  division: string | null;
  department: string | null;
  creator: string | null;
  entries: JournalEntry[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
  isImbalanced: boolean;
}

export type PresetRange = "Monthly" | "Quarterly" | "Yearly" | "Custom";

export interface FilterState {
  search: string;
  startDate: string;
  endDate: string;
  presetRange: PresetRange;
  branch: string;
  division: string;
  department: string;
  entryType: string;
  coa: string;
  sourceModule: string;
  showPostedOnly: boolean;
  status: string;
}

export interface AnalyticsSummary {
  jeCount: number;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  largestEntry: number;
  imbalancedCount: number;
  postedCount: number;
  unpostedCount: number;
}
