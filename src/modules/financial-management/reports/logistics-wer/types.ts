export interface LogisticsWerDispatchPlan {
  id: number;
  docNo: string;
  dispatchDate: string | null;
  timeOfDispatch: string | null;
  driverName: string | null;
  vehicleName: string | null;
  status: string | null;
  remarks: string | null;
  amount: number;
  isLiquidated?: boolean | null;
}

export type LogisticsWerDispatchPlanSummary = LogisticsWerDispatchPlan;

export interface LogisticsWerDisbursement {
  id: string;
  remarks: string | null;
  amount: number;
}

export interface LogisticsWerStaff {
  userId: number | null;
  name: string;
  role: string | null;
}

export interface LogisticsWerStopItem {
  name: string;
  quantity: number;
  unit: string | null;
  amount: number;
  brand: string | null;
  category: string | null;
  supplier: string | null;
}

export interface LogisticsWerStop {
  type: string;
  name: string;
  documentNo: string | null;
  documentAmount: number;
  sequence: number | null;
  distance: number | null;
  status: string | null;
  remarks: string | null;
  date: string | null;
  items: LogisticsWerStopItem[];
}

export interface LogisticsWerReportPage {
  content: LogisticsWerDispatchPlanSummary[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  range: {
    startDate: string;
    endDate: string;
  };
}

export interface LogisticsWerDispatchPlanDetail {
  plan: LogisticsWerDispatchPlan;
  disbursements: LogisticsWerDisbursement[];
  staff: LogisticsWerStaff[];
  stops: LogisticsWerStop[];
  disbursementTotal: number;
  supplierEligibility?: LogisticsWerSupplierEligibility | null;
  plannedAmount?: number | null;
  reservedAmount?: number | null;
  remainingAmount?: number | null;
  isLiquidated?: boolean | null;
  submissions?: LogisticsWerPayableSubmissionSummary[];
}

export interface LogisticsWerSupplierEligibility {
  eligible: boolean;
  driverId: number | null;
  supplierId: number | null;
  supplierName: string | null;
  reason: string | null;
}

export interface LogisticsWerPayableReceipt {
  id: number;
  fileId: string | null;
}

export interface LogisticsWerPayableLine {
  id: number;
  lineNo: number | null;
  amount: number;
  referenceNo: string | null;
  remarks: string | null;
  date: string | null;
  coaId: number | null;
  receipts: LogisticsWerPayableReceipt[];
}

export interface LogisticsWerPayableSubmission {
  id: number;
  status: string | null;
  totalAmount: number;
  submittedBy: number | null;
  submittedAt: string | null;
  decidedBy: number | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
  disbursementId: number | null;
  treasuryStatus: string | null;
  idempotencyKey: string | null;
  lines: LogisticsWerPayableLine[];
}

export interface LogisticsWerPayableSubmissionSummary {
  id: number;
  status: string | null;
  totalAmount: number;
  decisionRemarks: string | null;
  disbursementId: number | null;
  treasuryStatus: string | null;
  lineCount: number;
  receiptCount: number;
}
