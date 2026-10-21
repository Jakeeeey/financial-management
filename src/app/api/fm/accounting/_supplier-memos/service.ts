import { createHash } from "node:crypto";
import type { MemoDetail, MemoEligibility, MemoHistoryEvent, MemoMutationResult, SupplierMemo, SupplierMemoType } from "@/modules/financial-management/accounting/supplier-memos/types";
import { acquireMemoCapLock, isMemoActiveDisbursementStatus } from "../../treasury/disbursements/_memo-cap-integrity";
import type { MemoActor } from "./access";
import { directus, MemoError, positiveId, readByIds, readList, readRows, relationId, type Row } from "./directus";

const MEMO_FIELDS = "id,memo_number,type,supplier_id,date,amount,reason,status,chart_of_account,created_at,updated_at,encoder_id,deleted_at";
const AUDIT_FIELD = "supplier_memo_v1";
const AGENT_PREFIX = "VOS-FM-SupplierMemo/";
const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase();
const amount = (value: unknown) => Math.round(Math.abs(Number(value) || 0) * 100) / 100;

export function snapshot(memo: SupplierMemo): Row {
  return Object.fromEntries(["memo_number", "type", "supplier_id", "chart_of_account", "date", "amount", "reason", "status", "encoder_id", "deleted_at"]
    .map(field => [field, field === "amount" ? Number(memo.amount).toFixed(2) : memo[field as keyof SupplierMemo] ?? null]));
}

function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

type Revision = { id: number; data: Row; delta: Row; activity?: { id: number; timestamp: string; user_agent?: string } };
async function revisions(id: number) {
  return readList<Revision>("/revisions", { collection: { _eq: "suppliers_memo" }, item: { _eq: String(id) } },
    "id,data,delta,activity.id,activity.timestamp,activity.user_agent");
}

export async function getMemo(id: number, type: SupplierMemoType): Promise<SupplierMemo> {
  const rows = await readRows<SupplierMemo>("suppliers_memo", { id: { _eq: id }, type: { _eq: type } }, MEMO_FIELDS);
  if (!rows[0] || rows[0].deleted_at) throw new MemoError("Supplier memo not found.", 404);
  return { ...rows[0], id: Number(rows[0].id), supplier_id: relationId(rows[0].supplier_id),
    chart_of_account: relationId(rows[0].chart_of_account), amount: String(rows[0].amount), encoder_id: relationId(rows[0].encoder_id) || null };
}

async function byReferences<T = Row>(collection: string, field: string, references: string[], fields: string): Promise<T[]> {
  const result: T[] = [];
  const refs = [...new Set(references.filter(Boolean))];
  for (let index = 0; index < refs.length; index += 75) {
    result.push(...await readRows<T>(collection, { [field]: { _in: refs.slice(index, index + 75) } }, fields));
  }
  return result;
}

export function deriveEligibility(memo: SupplierMemo, applications: MemoEligibility["applications"], ambiguous: boolean, unresolved: boolean): MemoEligibility {
  const applied = amount(applications.filter(row => row.posted).reduce((sum, row) => sum + row.amount, 0));
  const reserved = amount(applications.filter(row => !row.posted).reduce((sum, row) => sum + row.amount, 0));
  const cancelled = memo.status.toUpperCase() === "CANCELLED";
  const missingHistoricalUsage = ["APPLIED", "USED"].includes(memo.status.toUpperCase()) && applications.length === 0;
  const unknownUsage = ambiguous || unresolved || missingHistoricalUsage;
  const reason = memo.deleted_at ? "This memo was deleted."
    : missingHistoricalUsage ? "This historical memo is marked applied or used, but its usage cannot be reconciled with the current disbursement references."
    : memo.status.toUpperCase() !== "AVAILABLE" ? "Only Available, unapplied memos can be edited or cancelled."
    : !memo.memo_number.trim() ? "The memo has no reference number. Its usage requires review."
    : unresolved ? "A linked payable has missing or unknown transaction information. Review its application history."
    : ambiguous ? "This supplier has multiple memos with this reference. The linked usage cannot be safely attributed."
    : applications.length ? "This memo is reserved or applied by " + applications.map(row => row.documentNo + " (" + row.status + ")").join(", ") + "."
    : null;
  return {
    canEdit: !reason, canCancel: !reason, blockedReason: reason, ambiguous: unknownUsage,
    appliedAmount: unknownUsage ? null : applied, reservedAmount: unknownUsage ? null : reserved,
    remainingAmount: cancelled ? 0 : unknownUsage ? null : Math.max(0, Math.round((Number(memo.amount) - applied - reserved) * 100) / 100),
    applications,
  };
}

export async function enrichMemos(memos: SupplierMemo[]): Promise<SupplierMemo[]> {
  if (!memos.length) return [];
  const refs = memos.map(row => row.memo_number);
  const [suppliers, accounts, users, candidates, payables] = await Promise.all([
    readByIds("suppliers", memos.map(row => relationId(row.supplier_id)), "id,supplier_name"),
    readByIds("chart_of_accounts", memos.map(row => relationId(row.chart_of_account)), "coa_id,gl_code,account_title"),
    readByIds("user", memos.map(row => relationId(row.encoder_id)), "user_id,user_fname,user_lname"),
    byReferences<SupplierMemo>("suppliers_memo", "memo_number", refs, "id,memo_number,supplier_id,type"),
    byReferences("disbursement_payables", "reference_no", refs, "id,reference_no,amount,disbursement_id"),
  ]);
  const headers = await readByIds("disbursement", payables.map(row => relationId(row.disbursement_id)),
    "id,doc_no,status,payee,is_employee");
  const headerMap = new Map(headers.map(row => [Number(row.id), row]));
  const supplierMap = new Map(suppliers.map(row => [Number(row.id), String(row.supplier_name)]));
  const accountMap = new Map(accounts.map(row => [Number(row.coa_id), row]));
  const userMap = new Map(users.map(row => [Number(row.user_id), [row.user_fname, row.user_lname].filter(Boolean).join(" ")]));
  return memos.map(row => {
    const memo = { ...row, supplier_id: relationId(row.supplier_id), chart_of_account: relationId(row.chart_of_account), amount: String(row.amount) };
    const applications = new Map<number, MemoEligibility["applications"][number]>();
    let unresolved = false;
    for (const payable of payables) {
      if (normalized(payable.reference_no) !== normalized(memo.memo_number)) continue;
      const parent = headerMap.get(relationId(payable.disbursement_id));
      if (!parent) { unresolved = true; continue; }
      if (relationId(parent.payee) !== memo.supplier_id || Number(parent.is_employee) === 1 || parent.is_employee === true) continue;
      const status = String(parent.status || "");
      if (!isMemoActiveDisbursementStatus(status)) {
        if (!["Cancelled", "Rejected"].includes(status)) unresolved = true;
        continue;
      }
      const id = Number(parent.id);
      const current = applications.get(id);
      applications.set(id, { id, documentNo: String(parent.doc_no || "TR-" + id), status,
        amount: amount((current?.amount || 0) + amount(payable.amount)), posted: status === "Posted" });
    }
    const duplicate = candidates.filter(other => relationId(other.supplier_id) === memo.supplier_id
      && normalized(other.memo_number) === normalized(memo.memo_number)).length > 1;
    const account = accountMap.get(memo.chart_of_account);
    return { ...memo, supplierName: supplierMap.get(memo.supplier_id) || "Supplier #" + memo.supplier_id,
      accountName: String(account?.account_title || "Account #" + memo.chart_of_account), accountCode: String(account?.gl_code || ""),
      creatorName: userMap.get(relationId(memo.encoder_id)) || "Not recorded",
      eligibility: deriveEligibility(memo, [...applications.values()], duplicate && applications.size > 0, unresolved) };
  });
}

export async function listMemos(type: SupplierMemoType) {
  return enrichMemos(await readRows<SupplierMemo>("suppliers_memo", { type: { _eq: type }, deleted_at: { _null: true } }, MEMO_FIELDS, "-created_at,-id"));
}

export async function getDetail(id: number, type: SupplierMemoType): Promise<MemoDetail> {
  const [memo] = await enrichMemos([await getMemo(id, type)]);
  const [history, audit] = await Promise.all([revisions(id), auditRows(id)]);
  const requests = new Map<string, Row>();
  for (const row of audit) requests.set(String(parseObject(row.new_value).requestId), row);
  const unresolved = [...requests.entries()].some(([requestId, row]) => !String(row.action).endsWith("_COMPLETED")
    && !String(row.action).endsWith("_FAILED") && !history.some(revision => revision.activity?.user_agent === AGENT_PREFIX + requestId));
  if (unresolved) memo.eligibility = { ...memo.eligibility!, canEdit: false, canCancel: false,
    blockedReason: "An earlier change has an unconfirmed outcome. Review History and reconcile that request before making another change." };
  return { memo, eligibility: memo.eligibility!, revisionToken: String(history.at(-1)?.id || 0) + ":" + digest(snapshot(memo)) };
}

export async function validateValues(input: Row, current?: SupplierMemo): Promise<Row> {
  const supplierId = positiveId(input.supplier_id);
  const coaId = positiveId(input.chart_of_account);
  const date = String(input.date || "");
  const value = String(input.amount ?? "");
  const reason = input.reason == null ? "" : String(input.reason).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new MemoError("Enter a valid memo date.");
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 99_999_999.99) throw new MemoError("Enter a positive amount of up to 99,999,999.99 with at most two decimal places.");
  if (reason.length > 255) throw new MemoError("The memo reason must be at most 255 characters.");
  const [suppliers, accounts] = await Promise.all([
    readByIds("suppliers", [supplierId], "id,supplier_type,isActive"), readByIds("chart_of_accounts", [coaId], "coa_id,account_title"),
  ]);
  if (!suppliers.length || (supplierId !== current?.supplier_id && (String(suppliers[0].supplier_type) !== "TRADE" || Number(suppliers[0].isActive) !== 1))) throw new MemoError("Select an active trade supplier.");
  if (!accounts[0]?.account_title) throw new MemoError("Select a valid chart of account.");
  return { supplier_id: supplierId, chart_of_account: coaId, date, amount: Number(value).toFixed(2), reason: reason || null };
}

type AuditEnvelope = { requestId: string; actorName: string; reason: string; requestHash: string; action: string; values: Row };
function parseObject(value: unknown): Row {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Row : {};
  } catch { return {}; }
}

async function auditRows(id: number, requestId?: string) {
  const rows = await readRows("audit_trail_table", {
    table_name: { _eq: "suppliers_memo" }, record_id: { _eq: id }, field_name: { _eq: AUDIT_FIELD },
    ...(requestId ? { new_value: { _contains: requestId } } : {}),
  }, "id,timestamp,user_id,action,old_value,new_value");
  return requestId ? rows.filter(row => parseObject(row.new_value).requestId === requestId) : rows;
}

async function appendAudit(id: number, actor: MemoActor, phase: string, before: Row, envelope: AuditEnvelope) {
  await directus("/items/audit_trail_table", { method: "POST", body: JSON.stringify({
    table_name: "suppliers_memo", record_id: id, field_name: AUDIT_FIELD, user_id: actor.id,
    action: "SUPPLIER_MEMO_" + envelope.action + "_" + phase, timestamp: new Date().toISOString(),
    old_value: JSON.stringify(before), new_value: JSON.stringify(envelope),
  }) });
}

export async function getHistory(id: number, type: SupplierMemoType): Promise<MemoHistoryEvent[]> {
  await getMemo(id, type);
  const [rows, native] = await Promise.all([auditRows(id), revisions(id)]);
  const grouped = new Map<string, Row>();
  for (const row of rows) {
    const envelope = parseObject(row.new_value);
    if (envelope.requestId) grouped.set(String(envelope.requestId), row);
  }
  const events: MemoHistoryEvent[] = [...grouped.entries()].map(([requestId, row]) => {
    const envelope = parseObject(row.new_value);
    const correlated = native.find(revision => revision.activity?.user_agent === AGENT_PREFIX + requestId);
    const completed = String(row.action).endsWith("_COMPLETED") || Boolean(correlated);
    return { id: "audit-" + row.id, action: String(envelope.action), requestId,
      outcome: completed ? "completed" : String(row.action).endsWith("_FAILED") ? "failed" : "needs-review",
      actorName: String(envelope.actorName || "Application user not recorded"), occurredAt: String(row.timestamp),
      reason: String(envelope.reason || "") || null, before: parseObject(row.old_value),
      after: completed && correlated ? correlated.data : parseObject(envelope.values) };
  });
  let previous: Row = {};
  for (const revision of native) {
    const before = previous;
    previous = revision.data || {};
    if (revision.activity?.user_agent?.startsWith(AGENT_PREFIX)) continue;
    events.push({ id: "revision-" + revision.id, action: Object.keys(before).length ? "Legacy change" : "Created / initial revision",
      outcome: "legacy", actorName: "Application user not recorded", occurredAt: revision.activity?.timestamp || "",
      reason: null, requestId: null, before, after: revision.data || {} });
  }
  return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function mutateMemo(id: number, type: SupplierMemoType, actor: MemoActor, action: "EDIT" | "CANCEL", input: Row): Promise<MemoMutationResult> {
  const requestId = String(input.requestId || "");
  const reason = String(input.changeReason || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new MemoError("A valid action request ID is required.");
  if (!reason || reason.length > 1000) throw new MemoError("Enter a change reason of up to 1,000 characters.");
  const initial = await getMemo(id, type);
  const release = await acquireMemoCapLock([{ referenceNo: initial.memo_number }], true);
  try {
    const current = await getDetail(id, type);
    const values = action === "EDIT" ? await validateValues(parseObject(input.values), current.memo) : { status: "CANCELLED" };
    const requestHash = digest({ action, values, reason });
    const prior = await auditRows(id, requestId);
    if (prior.length) {
      const envelope = parseObject(prior[0].new_value);
      if (envelope.requestHash !== requestHash) throw new MemoError("This request ID has already been used for a different change.", 409);
      const completed = prior.some(row => String(row.action).endsWith("_COMPLETED"))
        || (await revisions(id)).some(revision => revision.activity?.user_agent === AGENT_PREFIX + requestId);
      if (completed) return { data: current.memo, message: "This request was already saved. The latest memo is shown.", state: "saved", requestId };
      if (prior.some(row => String(row.action).endsWith("_FAILED"))) throw new MemoError("This request failed. Reload the memo before making a new attempt.", 409);
      return { message: "The previous request outcome needs review. Refresh the memo history before trying again.", state: "unknown", requestId };
    }
    if (input.expectedRevision !== current.revisionToken) throw new MemoError("This memo changed since you opened it. Reload its latest details before saving.", 409);
    if (!current.eligibility.canEdit) throw new MemoError(current.eligibility.blockedReason || "This memo cannot be changed.", 409);
    if (action === "EDIT" && Object.entries(values).every(([key, value]) => String(snapshot(current.memo)[key] ?? "") === String(value ?? ""))) throw new MemoError("There are no changes to save.");
    const before = snapshot(current.memo);
    const envelope: AuditEnvelope = { requestId, actorName: actor.name, reason, requestHash, action, values: { ...before, ...values } };
    try { await appendAudit(id, actor, "REQUESTED", before, envelope); }
    catch { throw new MemoError("The audit entry could not be recorded. The memo was not changed.", 503); }
    let saved: SupplierMemo;
    try {
      const result = await directus<{ data: SupplierMemo }>("/items/suppliers_memo/" + id, {
        method: "PATCH", headers: { "User-Agent": AGENT_PREFIX + requestId },
        body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
      });
      saved = result.data;
    } catch (error) {
      const uncertain = !(error instanceof MemoError) || error.status >= 500;
      await appendAudit(id, actor, uncertain ? "UNKNOWN" : "FAILED", before, envelope).catch(() => undefined);
      if (uncertain) return { message: "The save outcome could not be confirmed. Refresh this memo's history before trying again.", state: "unknown", requestId };
      throw error;
    }
    try { await appendAudit(id, actor, "COMPLETED", before, { ...envelope, values: snapshot(saved) }); }
    catch { return { data: saved, message: "Memo saved. Its audit completion needs review; refresh the history before making further changes.", state: "saved-audit-pending", requestId }; }
    return { data: saved, message: current.memo.memo_number + (action === "EDIT" ? " updated successfully." : " cancelled successfully."), state: "saved", requestId };
  } finally { release(); }
}

export async function createMemo(type: SupplierMemoType, actor: MemoActor, input: Row) {
  const values = await validateValues(input);
  const prefix = type === 1 ? "SCM-" : "SDM-";
  const release = await acquireMemoCapLock([{ referenceNo: prefix }]);
  try {
    const existing = await readRows<SupplierMemo>("suppliers_memo", { type: { _eq: type } }, "id,memo_number");
    const sequence = existing.reduce((max, memo) => memo.memo_number.startsWith(prefix) ? Math.max(max, Number(memo.memo_number.slice(prefix.length)) || 0) : max, 0) + 1;
    const memoNumber = prefix + String(sequence).padStart(3, "0");
    return (await directus<{ data: SupplierMemo }>("/items/suppliers_memo", { method: "POST",
      body: JSON.stringify({ ...values, memo_number: memoNumber, type, status: "Available", encoder_id: actor.id,
        created_at: new Date().toISOString() }) })).data;
  } finally { release(); }
}
