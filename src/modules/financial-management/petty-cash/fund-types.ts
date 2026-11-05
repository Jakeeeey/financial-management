import type { FundReference } from "./onboarding-types";
export type FundJournal = { id: number; number: string; accountingDate: string; amount: string };
export type FundDecision = { status: "APPROVED" | "REJECTED"; decidedBy: FundReference; decidedAt: string; remarks: string; journal: FundJournal | null; canViewJournal: boolean };
export type FundRecord = {
  id: string; docNo: string; name: string; status: string; imprestAmount: string; perVoucherLimit: string; approvalThreshold: string; expectedCash: string;
  version: number; createdAt: string; branch: FundReference | null; department: FundReference | null; division: FundReference | null;
  custodian: FundReference | null; requestedBy: FundReference | null; fundAccount: FundReference | null;
  approvedAmount: string | null; approvedAt: string | null; approvedBy: FundReference | null; decision: FundDecision | null;
};
export type FundDetails = {
  fund: FundRecord; canDecide: boolean; decisionBlocker: string | null; canViewJournal: boolean;
  preview: { accountingDate: string; policyVersion: number; digest: string; ready: boolean; lines: { account: FundReference; debit: string; credit: string }[]; blockers: { code: string; field: string; message: string }[] } | null;
  journal: FundJournal | null;
  custodianActiveFunds: { id: string; docNo: string; name: string }[];
  history: { action: string; reason: string | null; occurredAt: string; actorId: number; actorName: string }[];
  movements: { kind: string; amount: string; effectiveDate: string; resultingBalance: string }[];
};
