"use client";

import type { CertificateBody, PaymentBody, UnlockBody } from "../schemas";
import type { DeskPayload, PrefillResult } from "../types";

const BASE = "/api/fm/taxation/payments-2307";

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export class Payments2307ApiError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "Payments2307ApiError";
    this.fieldErrors = fieldErrors;
  }
}

function unwrap<T>(payload: Envelope<T>): T {
  if (!payload.success || payload.data === undefined) {
    throw new Payments2307ApiError(payload.error ?? "The request failed.", payload.fieldErrors);
  }
  return payload.data;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const payload = (await response.json().catch(() => ({ success: false, error: "The server sent no reply." }))) as Envelope<T>;
  return unwrap<T>(payload);
}

function jsonBody(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export function fetchDesk(companyId: number | null, year: number): Promise<DeskPayload> {
  const query = new URLSearchParams({ year: String(year) });
  if (companyId !== null) query.set("companyId", String(companyId));
  return request<DeskPayload>(`${BASE}?${query.toString()}`);
}

export function createCertificate(body: CertificateBody): Promise<{ id: number }> {
  return request<{ id: number }>(`${BASE}/certificates`, jsonBody(body));
}

export function updateCertificate(id: number, body: CertificateBody): Promise<{ id: number }> {
  return request<{ id: number }>(`${BASE}/certificates/${id}`, { ...jsonBody(body), method: "PATCH" });
}

export function deleteCertificate(id: number): Promise<{ id: number }> {
  return request<{ id: number }>(`${BASE}/certificates/${id}`, { method: "DELETE" });
}

export function prefillCertificates(companyId: number, year: number): Promise<PrefillResult> {
  return request<PrefillResult>(`${BASE}/prefill`, jsonBody({ companyId, year }));
}

export function createPayment(body: PaymentBody): Promise<{ id: number }> {
  return request<{ id: number }>(`${BASE}/payments`, jsonBody(body));
}

export function updatePayment(id: number, body: PaymentBody): Promise<{ id: number }> {
  return request<{ id: number }>(`${BASE}/payments/${id}`, { ...jsonBody(body), method: "PATCH" });
}

export function deletePayment(id: number): Promise<{ id: number }> {
  return request<{ id: number }>(`${BASE}/payments/${id}`, { method: "DELETE" });
}

export function lockPeriod(body: {
  companyId: number;
  year: number;
  periodKey: string;
  reason: string;
}): Promise<{ id: number }> {
  return request<{ id: number }>(`${BASE}/locks`, jsonBody(body));
}

export function unlockPeriod(periodKey: string, body: UnlockBody): Promise<{ id: number }> {
  return request<{ id: number }>(`${BASE}/locks/${periodKey}/unlock`, jsonBody(body));
}
