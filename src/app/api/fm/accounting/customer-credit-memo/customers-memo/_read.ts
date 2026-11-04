import type { DetailedMemo, DetailedMemoCollection, DetailedMemoInvoice, MemoApprovalRow } from "@/modules/financial-management/accounting/customers-memo/types";

export const MEMO_HEADER_FIELDS = [
  "id", "memo_number", "amount", "applied_amount", "reason", "status", "created_at", "type",
  "supplier_id.id", "supplier_id.supplier_name",
  "customer_id.id", "customer_id.customer_name", "customer_id.store_name", "customer_id.brgy", "customer_id.city", "customer_id.province",
  "salesman_id.id", "salesman_id.salesman_code", "salesman_id.salesman_name",
  "chart_of_account.coa_id", "chart_of_account.gl_code", "chart_of_account.account_title",
  "encoder_id", "encoder_id.user_fname", "encoder_id.user_lname",
];
export type ExportMemo = Omit<MemoApprovalRow, "customer_id" | "encoder_id"> & { customer_id: MemoApprovalRow["customer_id"] & { customer_code?: string }; encoder_id: MemoApprovalRow["encoder_id"] | number };
export type ExportDetail = Omit<DetailedMemo, "header"> & { header: ExportMemo };
type Reference = { memo_id: number | { id: number }; collection_id?: DetailedMemoCollection["collection_id"]; invoice_id?: DetailedMemoInvoice["invoice_id"] };

export class MemoExportError extends Error {
  constructor(message: string, readonly status = 503) { super(message); }
}
export function validMemoId(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }

function directusConfig() {
  const raw = (process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();
  if (!raw || !token) throw new MemoExportError("Customer Memo export data is not configured.");
  return { base: /^https?:\/\//i.test(raw) ? raw : `http://${raw}`, token };
}
async function readPage<T>(collection: string, fields: string[], filter: object, page: number, signal: AbortSignal): Promise<T[]> {
  signal.throwIfAborted(); const { base, token } = directusConfig();
  const params = new URLSearchParams({ fields: fields.join(","), filter: JSON.stringify(filter), limit: "200", page: String(page), sort: collection === "user" ? "user_id" : "id" });
  const response = await fetch(`${base}/items/${collection}?${params}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
  });
  if (!response.ok) throw new MemoExportError(response.status === 429 ? "Too many requests. Please wait and retry the export."
    : response.status === 403 ? "The data service did not allow access to the requested memo information."
      : "Memo information could not be loaded completely. Please retry the export.", [401, 403, 429].includes(response.status) ? response.status : 503);
  const result = await response.json().catch(() => null) as { data?: T[] } | null;
  if (!Array.isArray(result?.data)) throw new MemoExportError("Memo information was incomplete. Please retry the export.");
  return result.data;
}
async function readAll<T>(collection: string, fields: string[], filter: object, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await readPage<T>(collection, fields, filter, page, signal);
    rows.push(...batch);
    // Read until empty: also handles a Directus service-side cap below our requested page size.
    if (!batch.length) return rows;
  }
}
function amount(value: unknown, label: string): number {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "" || !Number.isFinite(Number(value)))
    throw new MemoExportError(`The ${label} is missing or invalid. Refresh the memo and retry.`, 409);
  return Number(value);
}
async function readHeaders(ids: number[], signal: AbortSignal): Promise<ExportMemo[]> {
  const rows = await readAll<ExportMemo>("customers_memo", [...MEMO_HEADER_FIELDS, "customer_id.customer_code"], { id: { _in: ids } }, signal);
  const found = new Map<number, ExportMemo>();
  for (const row of rows) {
    if (!validMemoId(row.id) || found.has(row.id) || !ids.includes(row.id)) throw new MemoExportError("Memo records changed during the export. Refresh and retry.", 409);
    found.set(row.id, { ...row, amount: amount(row.amount, "memo amount"), applied_amount: row.applied_amount == null ? 0 : amount(row.applied_amount, "applied amount") });
  }
  if (ids.some(id => !found.has(id))) throw new MemoExportError("A requested memo no longer exists or is unavailable. Refresh the list before exporting.", 404);
  const userIds = [...new Set(rows.map(row => typeof row.encoder_id === "number" ? row.encoder_id : null).filter(validMemoId))];
  if (userIds.length) {
    let encoders: { user_id: number; user_fname: string; user_lname: string }[] = [];
    try {
      encoders = await readAll<typeof encoders[number]>("user", ["user_id", "user_fname", "user_lname"], { user_id: { _in: userIds } }, signal);
    } catch {
      // Names are optional metadata; keep the source ID when enrichment is unavailable.
      signal.throwIfAborted();
    }
    const names = new Map(encoders.map(user => [user.user_id, user]));
    for (const [id, row] of found) {
      if (typeof row.encoder_id === "number") {
        const encoder = names.get(row.encoder_id);
        if (encoder && [encoder.user_fname, encoder.user_lname].some(name => name?.trim())) found.set(id, { ...row, encoder_id: encoder });
      }
    }
  }
  return ids.map(id => found.get(id)!);
}
export async function readSummaryMemos(ids: number[], signal: AbortSignal): Promise<ExportMemo[]> {
  const result: ExportMemo[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    const [headers, collections, invoices] = await Promise.all([
      readHeaders(chunk, signal),
      readAll<Reference>("collection_memos", ["memo_id.id", "collection_id.docNo"], { memo_id: { _in: chunk } }, signal),
      readAll<Reference>("customer_memo_invoices", ["memo_id.id", "invoice_id.invoice_no"], { memo_id: { _in: chunk } }, signal),
    ]);
    const cp = new Map<number, Set<string>>(), inv = new Map<number, Set<string>>();
    for (const [rows, map, getNumber] of [
      [collections, cp, (row: Reference) => row.collection_id?.docNo],
      [invoices, inv, (row: Reference) => row.invoice_id?.invoice_no],
    ] as const) for (const row of rows) {
      const id = typeof row.memo_id === "number" ? row.memo_id : row.memo_id?.id; const number = getNumber(row)?.trim();
      if (id && number) { const values = map.get(id) || new Set<string>(); values.add(number); map.set(id, values); }
    }
    result.push(...headers.map(row => ({ ...row, cpNumbers: [...(cp.get(row.id) || [])], invoiceNumbers: [...(inv.get(row.id) || [])] })));
  }
  return result;
}
export async function readMemoExportDetail(id: number, signal: AbortSignal): Promise<ExportDetail> {
  const [[header], collections, invoices] = await Promise.all([
    readHeaders([id], signal),
    readAll<DetailedMemoCollection>("collection_memos", ["amount", "collection_id.id", "collection_id.docNo"], { memo_id: { _eq: id } }, signal),
    readAll<DetailedMemoInvoice>("customer_memo_invoices", ["amount", "date_applied", "invoice_id.invoice_id", "invoice_id.invoice_no", "invoice_id.invoice_date", "invoice_id.due_date", "invoice_id.net_amount"], { memo_id: { _eq: id } }, signal),
  ]);
  return { header, collections: collections.map(row => ({ ...row, amount: amount(row.amount, "collection allocation") })),
    invoices: invoices.map(row => ({ ...row, amount: amount(row.amount, "invoice application"), invoice_id: row.invoice_id ? { ...row.invoice_id, net_amount: row.invoice_id.net_amount == null ? null : amount(row.invoice_id.net_amount, "invoice amount") } : null })) };
}
