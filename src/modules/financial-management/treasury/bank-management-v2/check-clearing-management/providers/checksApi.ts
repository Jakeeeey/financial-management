import type { BankCheck, CheckEvent, CheckbookSeries, CheckStatus } from "../types";

export type CheckCounts = Record<CheckStatus, number>;

export type CheckRegister = {
  checks: BankCheck[];
  counts: CheckCounts;
  accounts: { bankId: number; label: string }[];
  notice?: string;
};

export type PostingBlocked = { message: string; missingMappingKeys: string[] };

export type CheckMutationResult = {
  check: BankCheck;
  postingBlocked: PostingBlocked | null;
};

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
    fieldErrors?: Record<string, string[]>;
    missingMappingKeys?: string[];
  };

  if (!response.ok || body.success === false) {
    const error = new Error(body.error || "Request failed.") as Error & {
      fieldErrors?: Record<string, string[]>;
      missingMappingKeys?: string[];
    };
    error.fieldErrors = body.fieldErrors;
    error.missingMappingKeys = body.missingMappingKeys;
    throw error;
  }
  return body.data as T;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "ALL") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export type RegisterFilters = {
  direction?: string;
  status?: string;
  accountId?: number;
  q?: string;
};

export async function fetchRegister(filters: RegisterFilters): Promise<CheckRegister> {
  return unwrap<CheckRegister>(
    await fetch(`/api/fm/treasury/bank-management-v2/check-clearing-management/register${buildQuery(filters)}`, { cache: "no-store" }),
  );
}

export async function fetchCheckDetail(checkId: number): Promise<{ check: BankCheck; events: CheckEvent[] }> {
  return unwrap(await fetch(`/api/fm/treasury/bank-management-v2/check-clearing-management/${checkId}`, { cache: "no-store" }));
}

export type IssueCheckPayload = {
  bankAccountId: number;
  checkDate: string;
  amount: number;
  payee: string;
  remarks: string | null;
};

export type ReceiveCheckPayload = {
  bankAccountId: number;
  checkNo: string;
  checkDate: string;
  amount: number;
  draweeBank: string | null;
  payor: string | null;
  remarks: string | null;
};

export type CheckActionPayload = {
  action: "RELEASE" | "DEPOSIT" | "CLEAR" | "RETURN" | "CANCEL" | "REPLACE";
  returnReason?: string;
  note?: string;
  replacement?: { checkDate: string; amount: number; checkNo?: string };
};

function postJson<T>(url: string, payload: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((response) => unwrap<T>(response));
}

export function issueCheck(payload: IssueCheckPayload): Promise<CheckMutationResult> {
  return postJson("/api/fm/treasury/bank-management-v2/check-clearing-management/issue", payload);
}

export function receiveCheck(payload: ReceiveCheckPayload): Promise<CheckMutationResult> {
  return postJson("/api/fm/treasury/bank-management-v2/check-clearing-management/receive", payload);
}

export function actOnCheck(checkId: number, payload: CheckActionPayload): Promise<CheckMutationResult> {
  return postJson(`/api/fm/treasury/bank-management-v2/check-clearing-management/${checkId}/action`, payload);
}

export async function listCheckbooks(accountId?: number): Promise<{ series: CheckbookSeries[]; notice?: string }> {
  return unwrap(
    await fetch(`/api/fm/treasury/bank-management-v2/check-clearing-management/checkbooks${buildQuery({ accountId })}`, {
      cache: "no-store",
    }),
  );
}

export async function createCheckbook(payload: {
  bankAccountId: number;
  seriesStart: string;
  seriesEnd: string;
}): Promise<{ series: CheckbookSeries }> {
  return postJson("/api/fm/treasury/bank-management-v2/check-clearing-management/checkbooks", payload);
}
