// src/modules/financial-management/treasury/salesmen-expense-approval/providers/fetchProvider.ts
"use client";

import type {
  SalesmanExpenseRow,
  SalesmanExpenseDetail,
  ConfirmExpensesPayload,
  ApprovalLog,
  ApprovalLogDetail,
} from "../type";

const BASE = "/api/fm/treasury/salesman-expense-approval";

async function apiFetch(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 403) throw new Error("403_UNAUTHORIZED");
    const msg =
      (data as { error?: string; message?: string })?.message ||
      (data as { error?: string })?.error ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function listSalesmenWithExpenses(startDate?: string, endDate?: string): Promise<SalesmanExpenseRow[]> {
  let url = `${BASE}?resource=salesmen`;
  if (startDate && endDate) url += `&start_date=${startDate}&end_date=${endDate}`;
  const data = await apiFetch(url);
  return ((data as { data?: SalesmanExpenseRow[] })?.data ?? []) as SalesmanExpenseRow[];
}

export async function getSalesmanExpenses(salesmanId: number, startDate?: string, endDate?: string): Promise<SalesmanExpenseDetail> {
  let url = `${BASE}?resource=expenses&salesman_id=${salesmanId}`;
  if (startDate && endDate) url += `&start_date=${startDate}&end_date=${endDate}`;
  const data = await apiFetch(url);
  return data as SalesmanExpenseDetail;
}

export async function confirmExpenses(
  payload: ConfirmExpensesPayload
): Promise<{ ok: boolean; disbursement_id: number | null; doc_no?: string }> {
  const data = await apiFetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data as { ok: boolean; disbursement_id: number | null; doc_no?: string };
}

export async function getApprovalLogs(): Promise<ApprovalLog[]> {
  const data = (await apiFetch(`${BASE}?resource=logs`)) as { data: ApprovalLog[] };
  return data.data;
}

export async function getApprovalLogDetails(disbursementId: number): Promise<ApprovalLogDetail[]> {
  const data = (await apiFetch(`${BASE}?resource=log-details&disbursement_id=${disbursementId}`)) as { data: ApprovalLogDetail[] };
  return data.data;
}
