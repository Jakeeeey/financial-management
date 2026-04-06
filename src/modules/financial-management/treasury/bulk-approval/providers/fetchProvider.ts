// src/modules/financial-management/treasury/bulk-approval/providers/fetchProvider.ts
"use client";

import type {
  DraftRow,
  DraftDetail,
  LogDraft,
  ActivityLogDetail,
  VotePayload,
} from "../type";

const BASE = "/api/fm/treasury/bulk-approval";

async function apiFetch(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 403 || res.status === 401) throw new Error("403_UNAUTHORIZED");
    const msg =
      (data as { error?: string; message?: string })?.message ||
      (data as { error?: string })?.error ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function checkMyAccess(): Promise<{
  approver_id: number;
  division_id: number;
  approver_heirarchy: number;
}[]> {
  const data = await apiFetch(`${BASE}?resource=my-access`);
  return (data as { data: { approver_id: number; division_id: number; approver_heirarchy: number }[] }).data;
}

export async function listDrafts(): Promise<{ 
  data: DraftRow[]; 
  myLevel: number;
  levelsByDivision: Record<number, number[]>;
}> {
  const data = await apiFetch(`${BASE}?resource=drafts`);
  return data as { 
    data: DraftRow[]; 
    myLevel: number;
    levelsByDivision: Record<number, number[]>;
  };
}

export async function getDraftDetail(draftId: number): Promise<DraftDetail> {
  const data = await apiFetch(`${BASE}?resource=draft-detail&draft_id=${draftId}`);
  return data as DraftDetail;
}

export async function submitVote(payload: VotePayload): Promise<{
  ok: boolean;
  result: "APPROVED" | "REJECTED" | "TIER_ADVANCED" | "VOTE_RECORDED";
  message: string;
  doc_no?: string;
  next_tier?: number;
}> {
  const data = await apiFetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data as {
    ok: boolean;
    result: "APPROVED" | "REJECTED" | "TIER_ADVANCED" | "VOTE_RECORDED";
    message: string;
    doc_no?: string;
    next_tier?: number;
  };
}

export async function getActivityLogs(): Promise<LogDraft[]> {
  const data = await apiFetch(`${BASE}?resource=logs`);
  return (data as { data: LogDraft[] }).data;
}

export async function getActivityLogDetail(draftId: number): Promise<ActivityLogDetail[]> {
  const data = await apiFetch(`${BASE}?resource=log-detail&draft_id=${draftId}`);
  return (data as { data: ActivityLogDetail[] }).data;
}
