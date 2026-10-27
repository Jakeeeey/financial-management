export type ConsigneeSummary = {
  id: string;
  code: string;
  name: string;
  vatTreatment: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

export type ConsignmentWorkspace = "consignees" | "my-submissions" | "approvals";
export type ConsigneeQuery = { search: string; page: number; pageSize: number; status?: string };
export type ConsigneePage = { items: ConsigneeSummary[]; page: number; pageSize: number; total: number };
export type ConsigneeDetail = {
  summary: ConsigneeSummary;
  legalName: string | null;
  tradeName: string | null;
  tin: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  createdBy: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
  editable: boolean;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  replacesConsigneeId: string | null;
  canSubmit: boolean;
  canReview: boolean;
  canReplace: boolean;
  reviewRestriction: string | null;
  defaults: {
    commissionRate: number | null;
    paymentTermsDays: number | null;
    settlementFrequency: string | null;
    salesReportFrequency: string | null;
    exposureLimit: number | null;
    shrinkageResponsibility: string | null;
    ewtRate: number | null;
    priceTolerance: number | null;
    listingFeeSettlement: string | null;
  };
};

export type ConsigneeDraft = {
  requestId: string;
  version: number | null;
  legalName: string; tradeName: string; tin: string; vatTreatment: string;
  contactPerson: string; email: string; phone: string;
  addressLine: string; city: string; province: string; postalCode: string;
  defaults: ConsigneeDetail["defaults"];
};
