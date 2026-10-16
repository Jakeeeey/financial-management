export type ConsignmentRole = "CREATOR" | "APPROVER" | "CONTROLLER";
export type ConsignmentCapability =
  | "VIEW_OPERATIONAL_AREAS"
  | "CREATE_DOCUMENT"
  | "VIEW_OWN_SUBMISSIONS"
  | "REVIEW_DOCUMENT"
  | "VIEW_LEDGER"
  | "MANAGE_CONTROLS"
  | "MANAGE_POLICIES"
  | "MANAGE_ROLES"
  | "CLOSE_PERIOD"
  | "VOID_POSTED_DOCUMENT";

export type ConsignmentAccess = {
  userId: number;
  role: ConsignmentRole | null;
  capabilities: ConsignmentCapability[];
  canManageRoles: boolean;
};

export type ConsignmentDashboardSummary = {
  pendingSubmissions: number;
  pendingApprovals: number | null;
  postedTransactions: number;
  activeConsignees: number;
  activeAgreements: number;
  shipmentCount: number;
  shippedUnits: number;
  salesGrossAmount: number;
  billedAmount: number;
  returnedUnits: number;
  deductionsAmount: number;
  attentionItems: number;
  stockUnits: number | null;
  stockValueAtCost: number | null;
  unamortizedListingFeeBalance: number | null;
};

export type ConsignmentPeriodReadiness = {
  requestedThroughDate: string;
  currentClosedThroughDate: string | null;
  canClose: boolean;
  blockers: string[];
};

export type ConsignmentAccountMapping = {
  key: string;
  label: string;
  accountId: number | null;
  accountCode: string | null;
  accountName: string | null;
  updatedByUserId: number | null;
  updatedAt: string | null;
};

export type ConsignmentAccountMappings = {
  mappings: ConsignmentAccountMapping[];
  accounts: Array<{ accountId: number; accountCode: string | null; accountName: string | null }>;
  complete: boolean;
  postingEnabled: boolean;
};

export type ConsignmentAuditEvent = {
  auditEventId: number;
  occurredAt: string;
  actorUserId: number | null;
  actorName: string | null;
  action: string;
  referenceType: string;
  referenceId: string | null;
  referenceName: string | null;
  detailsJson: string | null;
};

export type ConsignmentPage<T> = {
  items: T[];
  page: number;
  size: number;
  hasNext: boolean;
};

export type ConsignmentConsigneeInput = {
  consigneeCode: string;
  displayName: string;
  legalName?: string | null;
  tradeName?: string | null;
  tin?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  vatTreatment?: string | null;
  defaultCommissionRate?: number | null;
  defaultPaymentTermsDays?: number | null;
  defaultSettlementFrequency?: string | null;
  defaultSalesReportFrequency?: string | null;
  defaultExposureLimit?: number | null;
  defaultShrinkageResponsibility?: string | null;
  defaultEwtRate?: number | null;
  defaultPriceTolerance?: number | null;
  defaultListingFeeSettlement?: string | null;
};

export type ConsignmentAgreementInput = {
  agreementReference?: string | null;
  consigneeId: number;
  startDate: string;
  endDate: string;
  commissionRate: number;
  paymentTermsDays: number;
  settlementFrequency: string;
  salesReportFrequency: string;
  exposureLimit: number;
  shrinkageResponsibility: string;
  ewtRate: number;
  priceTolerance: number;
  listingFeeSettlement: string;
  vatTreatment?: string | null;
};

export type ConsignmentConsignee = {
  consigneeId: number;
  consigneeCode: string;
  displayName: string;
  legalName: string | null;
  tradeName?: string | null;
  tin: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  vatTreatment: string | null;
  defaultCommissionRate?: number | null;
  defaultPaymentTermsDays?: number | null;
  defaultSettlementFrequency?: string | null;
  defaultSalesReportFrequency?: string | null;
  defaultExposureLimit?: number | null;
  defaultShrinkageResponsibility?: string | null;
  defaultEwtRate?: number | null;
  defaultPriceTolerance?: number | null;
  defaultListingFeeSettlement?: string | null;
  status: "PENDING" | "ACTIVE" | "REJECTED";
  createdByUserId: number;
  reviewedByUserId: number | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConsignmentAgreement = {
  agreementId: number;
  agreementReference: string | null;
  consigneeId: number;
  startDate: string;
  endDate: string;
  commissionRate: number;
  paymentTermsDays: number;
  settlementFrequency: string;
  salesReportFrequency: string;
  exposureLimit: number;
  shrinkageResponsibility: string;
  ewtRate: number;
  priceTolerance: number;
  listingFeeSettlement: string;
  vatTreatment: string | null;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "CLOSED";
  createdByUserId: number;
  reviewedByUserId: number | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConsignmentDocumentLine = {
  documentLineId: number;
  documentId: number;
  lineNumber: number;
  productId: number | null;
  sourceDocumentLineId: number | null;
  productCodeSnapshot: string | null;
  productNameSnapshot: string | null;
  quantity: number | null;
  unitCost: number | null;
  unitPrice: number | null;
  referenceUnitPrice: number | null;
  lineAmount: number | null;
  returnCondition: string | null;
  reasonCode: string | null;
  reasonDetail?: string | null;
  feeStartMonth?: string | null;
  feePeriodMonths?: number | null;
  feeTreatment?: string | null;
  settlementMethod?: string | null;
};

export type ConsignmentDocument = {
  documentId: number;
  documentType: string;
  documentDate: string;
  consigneeId: number;
  agreementId: number;
  externalReference: string | null;
  sourceDocumentId: number | null;
  salesPeriodStart?: string | null;
  salesPeriodEnd?: string | null;
  status: "DRAFT" | "PENDING" | "POSTED" | "REJECTED" | "VOIDED";
  grossAmount: number | null;
  commissionAmount: number | null;
  vatAmount: number | null;
  ewtAmount: number | null;
  netAmount: number | null;
  createdByUserId: number;
  reviewedByUserId: number | null;
  rejectionReason: string | null;
  journalEntryId: number | null;
  reversalJournalEntryId: number | null;
  voidReason: string | null;
  voidedByUserId: number | null;
  voidedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConsignmentCalculationPreview = {
  status: "OPERATIONAL_PREVIEW" | "UNAPPROVED_ACCOUNTING_PREVIEW" | "UNAPPROVED_TAX_PREVIEW";
  quantities: Record<string, number>;
  amounts: Record<string, number>;
};

export type ConsignmentDocumentDetail = {
  document: ConsignmentDocument;
  lines: ConsignmentDocumentLine[];
  warnings?: string[];
  calculationPreview?: ConsignmentCalculationPreview | null;
};

export type ConsignmentDocumentPreview = {
  warnings: string[];
  calculationPreview: ConsignmentCalculationPreview;
};

export type ConsignmentProductOption = {
  productId: number;
  productCode: string;
  productName: string;
};

export type ConsignmentDocumentLineInput = Partial<Omit<ConsignmentDocumentLine, "documentLineId" | "documentId" | "lineNumber">>;

export type ConsignmentDocumentInput = {
  documentType: string;
  documentDate: string;
  consigneeId: number;
  agreementId: number;
  externalReference?: string | null;
  sourceDocumentId?: number | null;
  salesPeriodStart?: string | null;
  salesPeriodEnd?: string | null;
  lines: ConsignmentDocumentLineInput[];
};

export type ConsignmentPolicy = {
  policyId: number;
  vatRate: number | null;
  ewtRate: number | null;
  defaultListingFeeTreatment: string | null;
  closedThroughDate: string | null;
  updatedByUserId: number | null;
  updatedAt: string;
};

export type ConsignmentListingFeeSchedule = {
  scheduleId: number;
  feeDocumentLineId: number;
  startMonth: string;
  periodMonths: number;
  originalAmount: number;
  monthlyAmount: number;
  amortizedAmount: number;
  remainingAmount: number;
  delistedAt: string | null;
  delistingDocumentId: number | null;
  refundAmount: number | null;
  createdAt: string;
  updatedAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/fm/consignment/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null) as { message?: string; detail?: string; error?: string; title?: string } | null;
  if (!response.ok) {
    const serverMessage = payload?.message || payload?.detail || payload?.title || payload?.error;
    const statusMessage = `Consignment request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`;
    throw new Error(serverMessage || statusMessage);
  }
  return payload as T;
}

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") params.set(key, String(value));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const consignmentApi = {
  getAccess: () => request<ConsignmentAccess>("access/me"),
  listConsignees: (search = "", page = 0, size = 50) => request<ConsignmentPage<ConsignmentConsignee>>(`consignees${queryString({ search, page, size })}`),
  saveConsignee: (input: ConsignmentConsigneeInput, id?: number) => request<ConsignmentConsignee>(id ? `consignees/${id}` : "consignees", { method: id ? "PUT" : "POST", body: JSON.stringify(input) }),
  reviewConsignee: (id: number, decision: "approve" | "reject", reason?: string) => request<ConsignmentConsignee>(`consignees/${id}/${decision}`, { method: "POST", body: JSON.stringify({ reason }) }),
  listAgreements: (search = "", page = 0, size = 50) => request<ConsignmentPage<ConsignmentAgreement>>(`agreements${queryString({ search, page, size })}`),
  saveAgreement: (input: ConsignmentAgreementInput, id?: number) => request<ConsignmentAgreement>(id ? `agreements/${id}` : "agreements", { method: id ? "PUT" : "POST", body: JSON.stringify(input) }),
  reviewAgreement: (id: number, decision: "approve" | "reject", reason?: string) => request<ConsignmentAgreement>(`agreements/${id}/${decision}`, { method: "POST", body: JSON.stringify({ reason }) }),
  closeAgreement: (id: number, reason: string) => request<ConsignmentAgreement>(`agreements/${id}/close`, { method: "POST", body: JSON.stringify({ reason }) }),
  listDocuments: (filters: { search?: string; status?: string; documentType?: string; consigneeId?: number; page?: number; size?: number } = {}) => request<ConsignmentPage<ConsignmentDocument>>(`documents${queryString(filters)}`),
  getDocument: (id: number) => request<ConsignmentDocumentDetail>(`documents/${id}`),
  previewDocument: (input: ConsignmentDocumentInput) => request<ConsignmentDocumentPreview>("documents/preview", { method: "POST", body: JSON.stringify(input) }),
  saveDocument: (input: ConsignmentDocumentInput, id?: number) => request<ConsignmentDocumentDetail>(id ? `documents/${id}` : "documents", { method: id ? "PUT" : "POST", body: JSON.stringify(input) }),
  submitDocument: (id: number) => request<ConsignmentDocumentDetail>(`documents/${id}/submit`, { method: "POST" }),
  approveDocument: (id: number) => request<ConsignmentDocumentDetail>(`documents/${id}/approve`, { method: "POST" }),
  rejectDocument: (id: number, reason: string) => request<ConsignmentDocumentDetail>(`documents/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  voidDocument: (id: number, reason: string) => request<ConsignmentDocumentDetail>(`documents/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) }),
  getDashboard: () => request<ConsignmentDashboardSummary>("reports/dashboard"),
  getStockPosition: (agreementId?: number) => request<Array<{ productId: number; productCode: string | null; productName: string | null; quantity: number; valueAtCost: number }>>(`reports/stock-position${queryString({ agreementId })}`),
  listTransactions: (filters: { search?: string; status?: string; documentType?: string; consigneeId?: number; page?: number; size?: number } = {}) => request<ConsignmentPage<ConsignmentDocument>>(`reports/transaction-register${queryString(filters)}`),
  getTrialBalance: (asOfDate: string) => request<{ asOfDate: string; lines: Array<{ accountId: number; accountCode: string; accountName: string; debit: number; credit: number; netBalance: number; sourceEntries: Array<{ documentId: number; documentType: string; externalReference: string | null; journalEntryId: number; journalEntryNumber: string; journalDate: string; journalDescription: string; debit: number; credit: number; reversal: boolean }> }>; totalDebits: number; totalCredits: number }>(`reports/trial-balance${queryString({ asOfDate })}`),
  getReconciliation: (asOfDate: string) => request<{ asOfDate: string; balanced: boolean; checks: Array<{ key: string; label: string; ledgerBalance: number; operationalBalance: number; variance: number; passed: boolean }> }>(`reports/reconciliation${queryString({ asOfDate })}`),
  listMySubmissions: (page = 0, size = 50) => request<ConsignmentPage<ConsignmentDocument>>(`reports/submissions${queryString({ page, size })}`),
  listApprovals: (page = 0, size = 50) => request<ConsignmentPage<ConsignmentDocument>>(`reports/approvals${queryString({ page, size })}`),
  listAuditTrail: (page = 0, size = 50) => request<ConsignmentPage<ConsignmentAuditEvent>>(`controls/audit-trail${queryString({ page, size })}`),
  listListingFeeSchedules: (page = 0, size = 50) => request<ConsignmentPage<ConsignmentListingFeeSchedule>>(`reports/listing-fee-schedules${queryString({ page, size })}`),
  getListingFeeSchedule: (feeLineId: number) => request<ConsignmentListingFeeSchedule>(`reports/listing-fee-schedules/line/${feeLineId}`),
  closePeriod: (closedThroughDate: string, reason: string) => request<ConsignmentPolicy>("controls/period/close", { method: "POST", body: JSON.stringify({ closedThroughDate, reason }) }),
  getPeriodReadiness: (through: string) => request<ConsignmentPeriodReadiness>(`controls/period/readiness${queryString({ through })}`),
  reopenLatestPeriod: (closedThroughDate: string, reason: string) => request<ConsignmentPolicy>("controls/period/reopen", { method: "POST", body: JSON.stringify({ closedThroughDate, reason }) }),
  getPolicy: () => request<ConsignmentPolicy | null>("controls/policies"),
  savePolicy: (policy: Partial<ConsignmentPolicy>) => request<ConsignmentPolicy>("controls/policies", { method: "PUT", body: JSON.stringify(policy) }),
  getAccountMappings: () => request<ConsignmentAccountMappings>("controls/account-mappings"),
  saveAccountMappings: (mappings: Array<{ key: string; accountId: number | null }>) => request<ConsignmentAccountMappings>("controls/account-mappings", { method: "PUT", body: JSON.stringify({ mappings }) }),
};

export async function searchConsignmentProducts(search: string): Promise<ConsignmentProductOption[]> {
  const params = new URLSearchParams({ q: search, active_only: "1", page: "1", page_size: "25" });
  const response = await fetch(`/api/fm/product-pricing/products?${params.toString()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => null) as {
    data?: Array<{ product_id?: unknown; product_code?: unknown; product_name?: unknown }>;
    message?: string;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(payload?.message || payload?.error || "Could not search active products.");
  return (payload?.data ?? []).flatMap((product) => {
    const productId = Number(product.product_id);
    const productCode = typeof product.product_code === "string" ? product.product_code : "";
    const productName = typeof product.product_name === "string" ? product.product_name : "";
    return Number.isFinite(productId) && productId > 0 && productName
      ? [{ productId, productCode, productName }]
      : [];
  });
}
