import type { ConsigneeDetail } from "./types";

export type AgreementTerms = ConsigneeDetail["defaults"];
export type AgreementConsignee = { id: string; code: string; name: string; status: string; vatTreatment: string | null; defaults: AgreementTerms };
export type AgreementSummary = {
  id: string; reference: string | null; consigneeId: string; consigneeCode: string; consigneeName: string;
  startDate: string; endDate: string; commissionRate: number; status: string; createdBy: string | null;
  createdByMe: boolean; editable: boolean; updatedAt: string | null;
};
export type AgreementDetail = {
  summary: AgreementSummary; consignee: AgreementConsignee; terms: AgreementTerms; vatTreatment: string | null;
  createdAt: string | null; updatedAt: string | null; version: number; editable: boolean;
  submittedBy: string | null; submittedAt: string | null; reviewedBy: string | null; reviewedAt: string | null;
  closedBy: string | null; closedAt: string | null; closureReason: string | null; rejectionReason: string | null;
  canSubmit: boolean; canReview: boolean; canClose: boolean; reviewRestriction: string | null; warnings: string[];
};
export type AgreementClosureBlocker = { code: string; message: string };
export type AgreementClosureReadiness = { canClose: boolean; blockers: AgreementClosureBlocker[] };
export type AgreementDraft = { requestId: string; version: number | null; consigneeId: string; startDate: string; endDate: string; terms: AgreementTerms };
export type AgreementQuery = { search: string; status: string; page: number; pageSize: number };
export type AgreementPage = { items: AgreementSummary[]; page: number; pageSize: number; total: number; statusCounts: Record<string, number> };
export type AgreementConsigneePage = { items: AgreementConsignee[]; page: number; pageSize: number; total: number };
