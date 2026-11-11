"use client";

import type { MemoBody, TransferBody } from "../schemas";
import type { PostedJournalEntry, TransactionFilters, TransactionKind, TransactionsPayload } from "../types";

const BASE = "/api/fm/treasury/bank-management-v2/cash-bank-transactions";

/** A failed request, carrying what the dialog needs to explain itself. */
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  missingMappingKeys: string[];

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
    missingMappingKeys: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.missingMappingKeys = missingMappingKeys;
  }
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string> | Record<string, string[]>;
  missingMappingKeys?: string[];
}

function firstMessages(raw: Record<string, string> | Record<string, string[]> | undefined): Record<string, string> {
  if (!raw) return {};
  const flattened: Record<string, string> = {};
  for (const [field, value] of Object.entries(raw)) {
    const message = Array.isArray(value) ? value[0] : value;
    if (typeof message === "string" && message) flattened[field] = message;
  }
  return flattened;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  let body: Envelope<T> = {};
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    body = {};
  }

  if (!response.ok || body.success === false) {
    throw new ApiError(
      body.error || "Something went wrong. Try again.",
      response.status,
      firstMessages(body.fieldErrors),
      body.missingMappingKeys ?? [],
    );
  }

  return body.data as T;
}

function toQuery(filters: TransactionFilters): string {
  const params = new URLSearchParams();
  if (filters.kind !== "ALL") params.set("kind", filters.kind);
  if (filters.bankName) params.set("bank", filters.bankName);
  if (filters.bankAccountId) params.set("bankAccountId", String(filters.bankAccountId));
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  return params.toString();
}

/** One page of the combined memo + transfer list, plus the dialog's picklists. */
export function fetchTransactions(filters: TransactionFilters): Promise<TransactionsPayload> {
  return request<TransactionsPayload>(`?${toQuery(filters)}`);
}

/** Creates a credit memo, debit memo or interest-earned memo. */
export function createMemoTransaction(body: MemoBody): Promise<{ refNo: string; jeNo: string }> {
  return request(`/`, { method: "POST", body: JSON.stringify(body) });
}

/** Creates a fund transfer, posting E05 or E06 leg 1. */
export function createFundTransfer(body: TransferBody): Promise<{ transferNo: string; jeNo: string; status: string }> {
  return request(`/transfers`, { method: "POST", body: JSON.stringify(body) });
}

/** Settles a PENDING transfer: E06 leg 2, status COMPLETED. */
export function settleFundTransfer(id: number, note?: string): Promise<{ id: number; status: string; jeNo: string }> {
  return request(`/transfers/${id}/settle`, { method: "POST", body: JSON.stringify({ note: note ?? "" }) });
}

/** Cancels a posted memo with a mirror journal entry. */
export function cancelBankMemo(id: number, reason: string): Promise<{ id: number; status: string }> {
  return request(`/memos/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}

/** Posts the entry a saved transaction is missing; 409 when it already has one. */
export function postTransactionEntry(
  kind: TransactionKind,
  id: number,
): Promise<{ id: number; jeNo: string; eventCode: string; lines: number }> {
  return request(`/${kind.toLowerCase()}/${id}/post`, { method: "POST" });
}

/** One posted entry with its lines, for the read-only ledger dialog. */
export function fetchJournalEntry(jeNo: string): Promise<PostedJournalEntry> {
  return request(`/journal/${encodeURIComponent(jeNo)}`);
}
