import type { PRListQuery, PRListResponse, ProcurementRequest, ProcurementDetail, CreatePRInput, UpdateDetailInput } from "../utils/types";

function qs(query: PRListQuery) {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.status) p.set("status", query.status);
  if (query.supplier_id) p.set("supplier_id", query.supplier_id);
  if (query.date_from) p.set("date_from", query.date_from);
  if (query.date_to) p.set("date_to", query.date_to);
  if (query.page) p.set("page", String(query.page));
  if (query.pageSize) p.set("pageSize", String(query.pageSize));
  return p.toString();
}

export async function fetchPRList(query: PRListQuery, signal?: AbortSignal): Promise<PRListResponse> {
  const url = `/api/fm/procurement/procurement-request?${qs(query)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch PR list (${res.status}): ${text}`);
  }
  return (await res.json()) as PRListResponse;
}

export async function fetchPRById(id: number, signal?: AbortSignal): Promise<{ master: ProcurementRequest; details: ProcurementDetail[] }> {
  const url = `/api/fm/procurement/procurement-request/${id}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch PR (${res.status}): ${text}`);
  }
  return (await res.json()) as { master: ProcurementRequest; details: ProcurementDetail[] };
}

export async function createPR(input: CreatePRInput, signal?: AbortSignal): Promise<{ id: number; procurement_no: string }> {
  const url = `/api/fm/procurement/procurement-request`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create PR (${res.status}): ${text}`);
  }
  return (await res.json()) as { id: number; procurement_no: string };
}

export async function updatePRDetail(detailId: number, input: UpdateDetailInput, signal?: AbortSignal): Promise<ProcurementDetail> {
  const url = `/api/fm/procurement/procurement-request/details/${detailId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update detail (${res.status}): ${text}`);
  }
  return (await res.json()) as ProcurementDetail;
}

export async function deletePRDetail(detailId: number, signal?: AbortSignal): Promise<void> {
  const url = `/api/fm/procurement/procurement-request/details/${detailId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete detail (${res.status}): ${text}`);
  }
}

export async function approvePR(id: number, approved_by: number, signal?: AbortSignal): Promise<void> {
  const url = `/api/fm/procurement/procurement-request/${id}/approve`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved_by }),
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to approve PR (${res.status}): ${text}`);
  }
}

export async function generatePOFromPR(id: number, encoder_id: number, signal?: AbortSignal): Promise<{ purchase_order_id: number; purchase_order_no: string }> {
  const url = `/api/fm/procurement/procurement-request/${id}/generate-po`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encoder_id }),
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to generate PO (${res.status}): ${text}`);
  }
  return (await res.json()) as { purchase_order_id: number; purchase_order_no: string };
}
