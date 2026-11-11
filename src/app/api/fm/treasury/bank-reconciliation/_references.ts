import { NextResponse } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { BANK_RECONCILIATION_ROOT, BANK_RECONCILIATION_WORKSPACES } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/workspaces";
import type { BankReconciliationContext, BankReconciliationReferenceResource, BankReconciliationReferences } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/reference-types";

type Row = Record<string, unknown>;
type Collection = { data: Row[]; meta?: { filter_count?: number | string } };

class ReferenceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function text(value: unknown) { return value == null ? "" : String(value).trim(); }
function enabled(value: unknown) { return value === true || value === 1 || value === "1"; }
function record(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

async function readCollection(collection: string, params: URLSearchParams): Promise<Collection> {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (!base || !token) throw new ReferenceError(503, "Bank Reconciliation reference services are not configured.");
  const response = await fetch(`${base}/items/${collection}?${params}`, {
    method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new ReferenceError(503, "Unable to load Bank Reconciliation references. Please retry.");
  const body = await response.json() as Collection;
  if (!Array.isArray(body.data)) throw new ReferenceError(503, "The reference service returned an invalid response.");
  return body;
}

function query(fields: string, filter: Row, limit = "-1") {
  return new URLSearchParams({ fields, filter: JSON.stringify(filter), limit });
}

async function context(identity: unknown): Promise<BankReconciliationContext> {
  const actorId = Number(record(identity).id);
  if (!Number.isSafeInteger(actorId) || actorId <= 0) throw new ReferenceError(401, "Please sign in again.");
  const paths = [BANK_RECONCILIATION_ROOT, ...Object.keys(BANK_RECONCILIATION_WORKSPACES).map(key => `${BANK_RECONCILIATION_ROOT}/${key}`)];
  const [users, modules, grants] = await Promise.all([
    readCollection("user", query("user_id,user_fname,user_mname,user_lname,user_email,role,isAdmin,is_deleted,is_blocked", { user_id: { _eq: actorId } }, "1")),
    readCollection("modules", query("id,parent_module_id,title,base_path,status", {
      subsystem_id: { slug: { _eq: "fm" } }, base_path: { _in: paths }, status: { _eq: "active" },
    })),
    readCollection("user_access_modules", query("module_id", { user_id: { _eq: actorId } })),
  ]);
  const user = users.data[0];
  if (!user || enabled(user.is_deleted) || enabled(user.is_blocked)) throw new ReferenceError(401, "An active ERP account is required. Please sign in again.");
  const parent = modules.data.find(module => module.base_path === BANK_RECONCILIATION_ROOT);
  if (!parent) throw new ReferenceError(503, "Bank Reconciliation navigation is not configured.");
  const admin = text(user.role).toUpperCase() === "ADMIN" || enabled(user.isAdmin);
  const allowed = new Set(grants.data.map(grant => Number(grant.module_id)));
  const workspaces: BankReconciliationContext["workspaces"] = [];
  for (const key of Object.keys(BANK_RECONCILIATION_WORKSPACES) as (keyof typeof BANK_RECONCILIATION_WORKSPACES)[]) {
    const path = `${BANK_RECONCILIATION_ROOT}/${key}`;
    const workspace = modules.data.find(item => item.base_path === path && Number(item.parent_module_id) === Number(parent.id));
    if (workspace && (admin || allowed.has(Number(workspace.id)))) workspaces.push({ key, title: text(workspace.title), path });
  }
  if (!workspaces.length) throw new ReferenceError(403, "Access to a Bank Reconciliation module is required.");
  const email = text(user.user_email);
  const name = [user.user_fname, user.user_mname, user.user_lname].map(text).filter(Boolean).join(" ") || email || "User";
  return { actor: { id: actorId, name, email }, workspaces };
}

/** Revalidate identity and grants for every BFF read; never authorize from decoded claims. */
export async function referenceResponse(read: (access: BankReconciliationContext) => Promise<unknown>) {
  let session: Response | undefined;
  let response: NextResponse;
  try {
    session = await proxySpring("/auth/me", { cache: "no-store" });
    if (!session.ok) {
      throw new ReferenceError([401, 403, 404].includes(session.status) ? 401 : 503,
        [401, 403, 404].includes(session.status) ? "Please sign in again." : "Unable to validate your session. Please retry.");
    }
    const access = await context(await session.json());
    response = NextResponse.json(await read(access));
  } catch (error) {
    response = NextResponse.json({ message: error instanceof ReferenceError ? error.message : "Bank Reconciliation references are temporarily unavailable. Please retry." },
      { status: error instanceof ReferenceError ? error.status : 503 });
  }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Cookie");
  for (const cookie of session?.headers.getSetCookie() || []) response.headers.append("Set-Cookie", cookie);
  return response;
}

const sources = {
  companies: { collection: "company", key: "company_id", fields: "company_id,company_code,company_name", sort: "company_name,company_id", search: ["company_code", "company_name"] },
  "bank-accounts": { collection: "bank_accounts", key: "bank_id", fields: "bank_id,bank_name,branch,account_number,currency,is_active,account_status,company_id", sort: "bank_name,branch,bank_id", search: ["bank_name", "branch"] },
  accounts: { collection: "chart_of_accounts", key: "coa_id", fields: "coa_id,gl_code,account_title,status,account_type.account_name,bsis_code.bsis_code", sort: "gl_code,coa_id", search: ["gl_code", "account_title"] },
} as const;

function resource(value: string): BankReconciliationReferenceResource {
  if (!Object.hasOwn(sources, value)) throw new ReferenceError(400, "Unknown reference resource.");
  return value as BankReconciliationReferenceResource;
}

function positiveInteger(value: string, label: string) {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number <= 0) throw new ReferenceError(400, `Invalid ${label}.`);
  return number;
}

function project(kind: BankReconciliationReferenceResource, row: Row): BankReconciliationReferences[BankReconciliationReferenceResource] {
  if (kind === "companies") return { id: Number(row.company_id), code: text(row.company_code), name: text(row.company_name) };
  if (kind === "bank-accounts") {
    const account = text(row.account_number);
    return {
      id: Number(row.bank_id), bankName: text(row.bank_name), branch: text(row.branch),
      maskedAccountNumber: account ? `•••• ${account.slice(-4)}` : null,
      currency: text(row.currency), status: text(row.account_status).toUpperCase(),
      isActive: enabled(row.is_active) && text(row.account_status).toUpperCase() === "ACTIVE",
      companyId: row.company_id == null ? null : Number(row.company_id),
    };
  }
  return {
    id: Number(row.coa_id), code: text(row.gl_code), name: text(row.account_title), status: text(row.status).toLowerCase(),
    classification: [record(row.bsis_code).bsis_code, record(row.account_type).account_name].map(text).filter(Boolean).join(" / "),
  };
}

export async function listReferences(kind: string, params: URLSearchParams) {
  const name = resource(kind), source = sources[name];
  const page = positiveInteger(params.get("page") ?? "1", "page");
  const pageSize = Math.min(100, positiveInteger(params.get("pageSize") ?? "25", "page size"));
  const offset = (page - 1) * pageSize;
  const search = (params.get("search") || "").trim();
  if (!Number.isSafeInteger(offset) || search.length > 200) throw new ReferenceError(400, "Invalid reference search or pagination.");
  const filter: Row = {};
  const conditions: Row[] = [];
  if (name === "bank-accounts") Object.assign(filter, { is_active: { _eq: 1 }, account_status: { _eq: "ACTIVE" } });
  if (name === "accounts") filter.status = { _in: ["pending", "approved"] };
  if (name === "bank-accounts" && params.has("companyId")) {
    const companyId = positiveInteger(params.get("companyId")!, "company ID");
    conditions.push({ _or: [{ company_id: { _eq: companyId } }, { company_id: { _null: true } }] });
  }
  if (params.has("bankName") || params.has("branch")) {
    const bankName = (params.get("bankName") || "").trim(), branch = (params.get("branch") || "").trim();
    if (name !== "bank-accounts" || !bankName || !params.has("branch")) throw new ReferenceError(400, "Select a complete bank and branch.");
    filter.bank_name = { _eq: bankName };
    if (branch) filter.branch = { _eq: branch };
    else conditions.push({ _or: [{ branch: { _eq: "" } }, { branch: { _null: true } }] });
  }
  if (conditions.length) filter._and = conditions;
  if (search) filter._or = source.search.map(field => ({ [field]: { _icontains: search } }));
  const upstream = query(source.fields, filter, String(pageSize));
  upstream.set("offset", String(offset)); upstream.set("sort", source.sort); upstream.set("meta", "filter_count");
  const result = await readCollection(source.collection, upstream);
  const total = Number(result.meta?.filter_count);
  if (!Number.isSafeInteger(total) || total < 0) throw new ReferenceError(503, "The reference service returned invalid pagination.");
  return { items: result.data.map(row => project(name, row)), total, page, pageSize };
}

export async function getReference(kind: string, value: string) {
  const name = resource(kind), source = sources[name];
  const id = positiveInteger(value, "reference ID");
  const result = await readCollection(source.collection, query(source.fields, { [source.key]: { _eq: id } }, "1"));
  if (!result.data.length) throw new ReferenceError(404, "Reference not found.");
  return project(name, result.data[0]);
}
