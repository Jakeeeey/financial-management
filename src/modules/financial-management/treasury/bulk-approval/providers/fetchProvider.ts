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

type ApiErrorBody = {
  error?: string;
  message?: string;
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  const data = (await res.json()) as unknown;

  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      throw new Error("403_UNAUTHORIZED");
    }

    const body = data as ApiErrorBody;
    const msg =
      body.message ||
      body.error ||
      `Request failed (${res.status})`;

    throw new Error(msg);
  }

  return data as T;
}

export async function checkMyAccess(): Promise<
  {
    approver_id: number;
    division_id: number;
    approver_heirarchy: number;
  }[]
> {
  const data = await apiFetch<{
    data: {
      approver_id: number;
      division_id: number;
      approver_heirarchy: number;
    }[];
  }>(`${BASE}?resource=my-access`);

  return data.data;
}

export async function listDrafts(
  startDate?: string,
  endDate?: string
): Promise<{
  data: DraftRow[];
  myLevel: number;
  levelsByDivision: Record<number, number[]>;
}> {
  let url = `${BASE}?resource=drafts`;

  if (startDate && endDate) {
    url += `&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  }

  return apiFetch<{
    data: DraftRow[];
    myLevel: number;
    levelsByDivision: Record<number, number[]>;
  }>(url);
}

export async function getAvailableWeeks(): Promise<
  {
    week_start: string;
    week_label: string;
  }[]
> {
  const data = await apiFetch<{
    data: {
      week_start: string;
      week_label: string;
    }[];
  }>(`${BASE}?resource=available-weeks`);

  return data.data;
}

export async function getDraftDetail(draftId: number): Promise<DraftDetail> {
  return apiFetch<DraftDetail>(
    `${BASE}?resource=draft-detail&draft_id=${encodeURIComponent(String(draftId))}`
  );
}

export async function submitVote(payload: VotePayload): Promise<{
  ok: boolean;
  result:
  | "APPROVED"
  | "REJECTED"
  | "WITH_CONCERN"
  | "TIER_ADVANCED"
  | "VOTE_RECORDED";
  message: string;
  doc_no?: string;
  next_tier?: number;
}> {
  return apiFetch<{
    ok: boolean;
    result:
    | "APPROVED"
    | "REJECTED"
    | "WITH_CONCERN"
    | "TIER_ADVANCED"
    | "VOTE_RECORDED";
    message: string;
    doc_no?: string;
    next_tier?: number;
  }>(BASE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getActivityLogs(): Promise<LogDraft[]> {
  const data = await apiFetch<{
    data: LogDraft[];
  }>(`${BASE}?resource=logs`);

  return data.data;
}

export async function getActivityLogDetail(
  draftId: number
): Promise<ActivityLogDetail[]> {
  const data = await apiFetch<{
    data: ActivityLogDetail[];
  }>(`${BASE}?resource=log-detail&draft_id=${encodeURIComponent(String(draftId))}`);

  return data.data;
}
