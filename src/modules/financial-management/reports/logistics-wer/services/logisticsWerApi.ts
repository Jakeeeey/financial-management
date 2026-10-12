import type {
  LogisticsWerDispatchPlan,
  LogisticsWerDispatchPlanDetail,
  LogisticsWerCoaBudgetBalance,
  LogisticsWerPayableLine,
  LogisticsWerPayableReceipt,
  LogisticsWerPayableSubmissionDetails,
  LogisticsWerPayableSubmissionLineDetails,
  LogisticsWerPayableSubmission,
  LogisticsWerPayableSubmissionSummary,
  LogisticsWerReportPage,
  LogisticsWerStaff,
  LogisticsWerStop,
  LogisticsWerStopItem,
  LogisticsWerSupplierEligibility,
} from "../types";

const ENDPOINT = "/api/fm/reports/logistics-wer";

export interface LogisticsWerReportQuery {
  startDate: string;
  endDate: string;
  search: string;
  status: string;
  page: number;
  size: number;
}

interface DispatchApprovalBudget {
  id?: unknown;
  coaId?: unknown;
  coaCode?: unknown;
  coaTitle?: unknown;
  remarks?: unknown;
  amount?: unknown;
}

interface DispatchApprovalStaff {
  userId?: unknown;
  name?: unknown;
  role?: unknown;
}

interface DispatchApprovalStopItem {
  name?: unknown;
  quantity?: unknown;
  unit?: unknown;
  amount?: unknown;
  brand?: unknown;
  category?: unknown;
  supplier?: unknown;
}

interface DispatchApprovalStop {
  type?: unknown;
  name?: unknown;
  documentNo?: unknown;
  documentAmount?: unknown;
  sequence?: unknown;
  distance?: unknown;
  status?: unknown;
  remarks?: unknown;
  date?: unknown;
  items?: DispatchApprovalStopItem[] | null;
}

interface DispatchApprovalResponse {
  id?: unknown;
  docNo?: unknown;
  driverId?: unknown;
  vehicleId?: unknown;
  startingPoint?: unknown;
  status?: unknown;
  amount?: unknown;
  totalDistance?: unknown;
  estimatedTimeOfDispatch?: unknown;
  staff?: DispatchApprovalStaff[] | null;
  budgets?: DispatchApprovalBudget[] | null;
  stops?: DispatchApprovalStop[] | null;
  werPayables?: DispatchApprovalWerPayables | null;
}

interface DispatchApprovalWerReceipt {
  id?: unknown;
  fileId?: unknown;
}

interface DispatchApprovalLine {
  id?: unknown;
  lineNo?: unknown;
  amount?: unknown;
  referenceNo?: unknown;
  remarks?: unknown;
  date?: unknown;
  coaId?: unknown;
  divisionId?: unknown;
  receipts?: DispatchApprovalWerReceipt[] | null;
}

interface DispatchApprovalSubmission {
  id?: unknown;
  departmentId?: unknown;
  status?: unknown;
  totalAmount?: unknown;
  submittedBy?: unknown;
  submittedAt?: unknown;
  decidedBy?: unknown;
  decidedAt?: unknown;
  decisionRemarks?: unknown;
  disbursementId?: unknown;
  treasuryStatus?: unknown;
  idempotencyKey?: unknown;
  lines?: DispatchApprovalLine[] | null;
}

interface DispatchApprovalSubmissionSummary {
  id?: unknown;
  status?: unknown;
  totalAmount?: unknown;
  decisionRemarks?: unknown;
  disbursementId?: unknown;
  disbursementDocNo?: unknown;
  treasuryStatus?: unknown;
  lineCount?: unknown;
  receiptCount?: unknown;
}

interface DispatchApprovalWerPayables {
  budgetContextAvailable?: unknown;
  budgetContextError?: unknown;
  dispatchPlanValue?: unknown;
  reservedAmount?: unknown;
  remainingAmount?: unknown;
  allocatedExpenseBudget?: unknown;
  unclassifiedBudgetAmount?: unknown;
  unclassifiedReservedAmount?: unknown;
  overBudgetAmount?: unknown;
  budgetBalancesByCoa?: Array<{
    coaId?: unknown;
    allocatedAmount?: unknown;
    reservedAmount?: unknown;
    remainingAmount?: unknown;
    overBudgetAmount?: unknown;
  }> | null;
  isLiquidated?: unknown;
  supplierEligibility?: {
    eligible?: unknown;
    driverId?: unknown;
    supplierId?: unknown;
    supplierName?: unknown;
    reason?: unknown;
  } | null;
  submissions?: DispatchApprovalSubmissionSummary[] | null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const result = asString(value);
  return result || null;
}

function asNumber(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function toDateOnly(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { message?: string; detail?: string; error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message || payload?.detail || payload?.error || `Logistics WER request failed with status ${response.status}.`);
  }
  return payload as T;
}

export async function fetchLogisticsWerReport(query: LogisticsWerReportQuery): Promise<LogisticsWerReportPage> {
  const params = new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
    page: String(query.page),
    size: String(query.size),
  });
  if (query.search.trim()) params.set("search", query.search.trim());
  if (query.status && query.status !== "ALL") params.set("status", query.status);

  const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return readJson<LogisticsWerReportPage>(response);
}

function mapPlan(data: DispatchApprovalResponse, sourcePlan?: LogisticsWerDispatchPlan): LogisticsWerDispatchPlan {
  const id = asNumber(data.id);

  return {
    id,
    docNo: asString(data.docNo) || sourcePlan?.docNo || "",
    dispatchDate: toDateOnly(data.estimatedTimeOfDispatch) || sourcePlan?.dispatchDate || null,
    timeOfDispatch: asNullableString(data.estimatedTimeOfDispatch) || sourcePlan?.timeOfDispatch || null,
    driverName: sourcePlan?.driverName || null,
    vehicleName: sourcePlan?.vehicleName || null,
    status: asNullableString(data.status) || sourcePlan?.status || null,
    remarks: sourcePlan?.remarks || asNullableString(data.startingPoint),
    amount: asNumber(data.amount) || sourcePlan?.amount || 0,
  };
}

function mapStaff(data: DispatchApprovalStaff): LogisticsWerStaff {
  return {
    userId: asNullableNumber(data.userId),
    name: asString(data.name) || "Unknown",
    role: asNullableString(data.role),
  };
}

function mapStopItem(data: DispatchApprovalStopItem): LogisticsWerStopItem {
  return {
    name: asString(data.name) || "Unknown item",
    quantity: asNumber(data.quantity),
    unit: asNullableString(data.unit),
    amount: asNumber(data.amount),
    brand: asNullableString(data.brand),
    category: asNullableString(data.category),
    supplier: asNullableString(data.supplier),
  };
}

function mapStop(data: DispatchApprovalStop): LogisticsWerStop {
  return {
    type: asString(data.type) || "STOP",
    name: asString(data.name) || "Unnamed stop",
    documentNo: asNullableString(data.documentNo),
    documentAmount: asNumber(data.documentAmount),
    sequence: asNullableNumber(data.sequence),
    distance: asNullableNumber(data.distance),
    status: asNullableString(data.status),
    remarks: asNullableString(data.remarks),
    date: asNullableString(data.date),
    items: (data.items ?? []).map(mapStopItem),
  };
}

function mapDetails(data: DispatchApprovalResponse, sourcePlan?: LogisticsWerDispatchPlan): LogisticsWerDispatchPlanDetail {
  const budgetLines = (data.budgets ?? []).map((budget) => ({
    id: asNumber(budget.id),
    coaId: asNullableNumber(budget.coaId),
    coaCode: asNullableString(budget.coaCode),
    coaTitle: asNullableString(budget.coaTitle),
    remarks: asNullableString(budget.remarks),
    amount: asNumber(budget.amount),
  }));
  const werPayables = data.werPayables ?? null;

  return {
    plan: mapPlan(data, sourcePlan),
    budgetLines,
    staff: (data.staff ?? []).map(mapStaff),
    stops: (data.stops ?? []).map(mapStop),
    budgetTotal: budgetLines.reduce((total, line) => total + line.amount, 0),
    supplierEligibility: mapEligibility(werPayables?.supplierEligibility),
    dispatchPlanValue: asNullableNumber(werPayables?.dispatchPlanValue),
    reservedAmount: asNullableNumber(werPayables?.reservedAmount),
    remainingAmount: asNullableNumber(werPayables?.remainingAmount),
    budgetContextAvailable: werPayables?.budgetContextAvailable === true,
    budgetContextError: asNullableString(werPayables?.budgetContextError),
    allocatedExpenseBudget: asNullableNumber(werPayables?.allocatedExpenseBudget),
    unclassifiedBudgetAmount: asNullableNumber(werPayables?.unclassifiedBudgetAmount),
    unclassifiedReservedAmount: asNullableNumber(werPayables?.unclassifiedReservedAmount),
    overBudgetAmount: asNullableNumber(werPayables?.overBudgetAmount),
    budgetBalancesByCoa: (werPayables?.budgetBalancesByCoa ?? []).map((balance): LogisticsWerCoaBudgetBalance => ({
      coaId: asNumber(balance.coaId),
      allocatedAmount: asNumber(balance.allocatedAmount),
      reservedAmount: asNumber(balance.reservedAmount),
      remainingAmount: asNumber(balance.remainingAmount),
      overBudgetAmount: asNumber(balance.overBudgetAmount),
    })),
    isLiquidated: werPayables?.isLiquidated === true,
    submissions: (werPayables?.submissions ?? []).map(mapSubmissionSummary),
  };
}

function mapEligibility(
  data: DispatchApprovalWerPayables["supplierEligibility"],
): LogisticsWerSupplierEligibility | null {
  if (!data) return null;
  return {
    eligible: data.eligible === true,
    driverId: asNullableNumber(data.driverId),
    supplierId: asNullableNumber(data.supplierId),
    supplierName: asNullableString(data.supplierName),
    reason: asNullableString(data.reason),
  };
}

function mapReceipt(data: DispatchApprovalWerReceipt): LogisticsWerPayableReceipt {
  return {
    id: asNumber(data.id),
    fileId: asNullableString(data.fileId),
  };
}

function mapSubmissionLine(data: DispatchApprovalLine): LogisticsWerPayableLine {
  return {
    id: asNumber(data.id),
    lineNo: asNullableNumber(data.lineNo),
    amount: asNumber(data.amount),
    referenceNo: asNullableString(data.referenceNo),
    remarks: asNullableString(data.remarks),
    date: asNullableString(data.date),
    coaId: asNullableNumber(data.coaId),
    divisionId: asNullableNumber(data.divisionId),
    receipts: (data.receipts ?? []).map(mapReceipt),
  };
}

function mapSubmission(data: DispatchApprovalSubmission): LogisticsWerPayableSubmission {
  return {
    id: asNumber(data.id),
    departmentId: asNullableNumber(data.departmentId),
    status: asNullableString(data.status),
    totalAmount: asNumber(data.totalAmount),
    submittedBy: asNullableNumber(data.submittedBy),
    submittedAt: asNullableString(data.submittedAt),
    decidedBy: asNullableNumber(data.decidedBy),
    decidedAt: asNullableString(data.decidedAt),
    decisionRemarks: asNullableString(data.decisionRemarks),
    disbursementId: asNullableNumber(data.disbursementId),
    treasuryStatus: asNullableString(data.treasuryStatus),
    idempotencyKey: asNullableString(data.idempotencyKey),
    lines: (data.lines ?? []).map(mapSubmissionLine),
  };
}

function mapSubmissionSummary(data: DispatchApprovalSubmissionSummary): LogisticsWerPayableSubmissionSummary {
  return {
    id: asNumber(data.id),
    status: asNullableString(data.status),
    totalAmount: asNumber(data.totalAmount),
    decisionRemarks: asNullableString(data.decisionRemarks),
    disbursementId: asNullableNumber(data.disbursementId),
    disbursementDocNo: asNullableString(data.disbursementDocNo),
    treasuryStatus: asNullableString(data.treasuryStatus),
    lineCount: asNumber(data.lineCount),
    receiptCount: asNumber(data.receiptCount),
  };
}

export async function fetchLogisticsWerDetails(
  id: number,
  sourcePlan?: LogisticsWerDispatchPlan,
): Promise<LogisticsWerDispatchPlanDetail> {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(String(id))}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await readJson<DispatchApprovalResponse>(response);
  return mapDetails(data, sourcePlan);
}

export interface PayableLineInput {
  id?: number;
  amount: number;
  referenceNo?: string | null;
  remarks?: string | null;
  date?: string | null;
  coaId?: number | null;
  divisionId?: number | null;
  receiptFileIds?: string[];
}

export interface PayableDepartmentOption {
  departmentId: number;
  departmentName: string;
}

export interface PayableDivisionOption {
  divisionId: number;
  divisionName: string;
}

export interface StagedReceipt {
  fileId: string;
  fileName: string | null;
}

export interface PayableCoaOption {
  coaId: number;
  label: string;
}

export interface BudgetClassificationInput {
  coaId: number;
  remarks: string;
}

export interface BudgetAllocationInput {
  coaId: number;
  amount: number;
  remarks: string;
}

export async function saveBudgetClassification(
  planId: number,
  budgetId: number,
  input: BudgetClassificationInput,
): Promise<void> {
  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(String(planId))}/budgets/${encodeURIComponent(String(budgetId))}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
  await readJson(response);
}

export async function saveBudgetAllocations(
  planId: number,
  budgets: BudgetAllocationInput[],
): Promise<void> {
  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(String(planId))}/budgets`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgets }),
      cache: "no-store",
    },
  );
  await readJson(response);
}

async function postPayables(
  planId: number,
  action: "save-draft" | "submit" | "withdraw",
  payload: Record<string, unknown>,
): Promise<LogisticsWerPayableSubmission> {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(String(planId))}/payables`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
    cache: "no-store",
  });
  const data = await readJson<{ draft?: DispatchApprovalSubmission }>(response);
  return mapSubmission(data.draft ?? {});
}

export function savePayableDraft(
  planId: number,
  departmentId: number | null,
  lines: PayableLineInput[],
  idempotencyKey?: string,
): Promise<LogisticsWerPayableSubmission> {
  return postPayables(planId, "save-draft", { departmentId, lines, idempotencyKey });
}

export function submitPayable(
  planId: number,
  departmentId: number | null,
  lines: PayableLineInput[],
  idempotencyKey?: string,
): Promise<LogisticsWerPayableSubmission> {
  return postPayables(planId, "submit", { departmentId, lines, idempotencyKey });
}

export function updatePayableSubmission(
  planId: number,
  submissionId: number,
  action: "save-draft" | "submit",
  departmentId: number | null,
  lines: PayableLineInput[],
): Promise<LogisticsWerPayableSubmission> {
  return postPayables(planId, action, { submissionId, departmentId, lines });
}

export function withdrawPayableSubmission(
  planId: number,
  submissionId: number,
): Promise<LogisticsWerPayableSubmission> {
  return postPayables(planId, "withdraw", { submissionId });
}

export async function fetchPayableSubmissionDetails(
  planId: number,
  submissionId: number,
): Promise<LogisticsWerPayableSubmissionDetails> {
  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(String(planId))}/payables/${encodeURIComponent(String(submissionId))}`,
    { credentials: "include", cache: "no-store" },
  );
  const data = await readJson<{
    submissionId?: unknown;
    departmentId?: unknown;
    canEdit?: unknown;
    lines?: DispatchApprovalLine[] | null;
  }>(response);
  return {
    submissionId: asNumber(data.submissionId),
    departmentId: asNullableNumber(data.departmentId),
    canEdit: data.canEdit === true,
    lines: (data.lines ?? []).map((line): LogisticsWerPayableSubmissionLineDetails => ({
      id: asNumber(line.id),
      lineNo: asNullableNumber(line.lineNo),
      amount: asNumber(line.amount),
      referenceNo: asNullableString(line.referenceNo),
      date: asNullableString(line.date),
      coaId: asNullableNumber(line.coaId),
      divisionId: asNullableNumber(line.divisionId),
      remarks: asNullableString(line.remarks),
      receipts: (line.receipts ?? []).map(mapReceipt),
    })),
  };
}

export async function fetchPayableDepartments(): Promise<PayableDepartmentOption[]> {
  const response = await fetch("/api/fm/setup/departments", { credentials: "include", cache: "no-store" });
  const rows = await readJson<Array<{ departmentId?: unknown; departmentName?: unknown }>>(response);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    departmentId: asNumber(row.departmentId),
    departmentName: asString(row.departmentName),
  })).filter((row) => row.departmentId > 0 && row.departmentName.length > 0);
}

export async function fetchPayableDivisions(): Promise<PayableDivisionOption[]> {
  const response = await fetch("/api/fm/setup/divisions", { credentials: "include", cache: "no-store" });
  const rows = await readJson<Array<{ divisionId?: unknown; divisionName?: unknown }>>(response);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    divisionId: asNumber(row.divisionId),
    divisionName: asString(row.divisionName),
  })).filter((row) => row.divisionId > 0 && row.divisionName.length > 0);
}

export async function uploadPayableReceipt(planId: number, file: File): Promise<StagedReceipt> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(String(planId))}/payables/receipts`,
    { method: "POST", credentials: "include", body: formData, cache: "no-store" },
  );
  const data = await readJson<{ fileId?: unknown; fileName?: unknown }>(response);
  return { fileId: asString(data.fileId), fileName: asNullableString(data.fileName) };
}

export async function deletePayableReceipt(planId: number, fileId: string): Promise<void> {
  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(String(planId))}/payables/receipts/${encodeURIComponent(fileId)}`,
    { method: "DELETE", credentials: "include", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || `Receipt removal failed with status ${response.status}.`);
  }
}

export async function fetchPayableCoas(): Promise<PayableCoaOption[]> {
  const response = await fetch("/api/fm/treasury/coas?forPayable=true", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await readJson<Array<{ coaId?: unknown; glCode?: unknown; accountTitle?: unknown }>>(response);
  return (Array.isArray(payload) ? payload : []).map((row) => {
    const coaId = asNumber(row.coaId);
    const title = asString(row.accountTitle) || `COA ${coaId}`;
    const code = asString(row.glCode);
    return { coaId, label: code ? `${code} · ${title}` : title };
  }).filter((row) => row.coaId > 0);
}
