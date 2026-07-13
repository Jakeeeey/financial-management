// src/modules/financial-management/treasury/bulk-approval/providers/fetchProvider.ts
"use client";

import type {
  ActivityLogDetail,
  ApprovalContext,
  DraftDetail,
  DraftRow,
  FinalHeaderDecisionPayload,
  FinalHeaderGroup,
  FinalTopSheetResponse,
  LogDraft,
  VotePayload,
} from "../type";

const BASE = "/api/fm/treasury/bulk-approval";

type ApiErrorBody = {
  error?: string;
  message?: string;
};

async function readJsonSafely(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return res.json() as Promise<unknown>;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  const data = await readJsonSafely(res);

  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      throw new Error("403_UNAUTHORIZED");
    }

    const body = data as ApiErrorBody | null;
    const msg = body?.message || body?.error || `Request failed (${res.status})`;

    throw new Error(msg);
  }

  return data as T;
}

export async function checkMyAccess(): Promise<
  {
    approver_id: number;
    division_id: number;
    division_name: string;
    approver_heirarchy: number;
  }[]
> {
  const data = await apiFetch<{
    data: {
      approver_id: number;
      division_id: number;
      division_name: string;
      approver_heirarchy: number;
    }[];
  }>(`${BASE}?resource=my-access`);

  return data.data;
}

export async function getMyApprovalContexts(): Promise<{ contexts: ApprovalContext[]; currentUserName: string }> {
  const data = await apiFetch<{ data: ApprovalContext[]; currentUserName?: string }>(
    `${BASE}?resource=my-approval-contexts`
  );

  return {
    contexts: data.data ?? [],
    currentUserName: data.currentUserName ?? "",
  };
}

export async function listDrafts(
  divisionId?: number
): Promise<{
  data: DraftRow[];
  myLevel: number;
  levelsByDivision: Record<number, number[]>;
}> {
  let url = `${BASE}?resource=drafts`;

  if (divisionId) {
    url += `&divisionId=${divisionId}`;
  }

  return apiFetch<{
    data: DraftRow[];
    myLevel: number;
    levelsByDivision: Record<number, number[]>;
  }>(url);
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

export async function getFinalHeaderGroups(): Promise<FinalHeaderGroup[]> {
  const data = await apiFetch<{ data: FinalHeaderGroup[] }>(
    `${BASE}?resource=final-header-groups`
  );

  return data.data ?? [];
}

export async function getFinalTopSheet(params: {
  division_id: number;
  period_from: string;
  period_to: string;
}): Promise<FinalTopSheetResponse> {
  const qs = new URLSearchParams({
    resource: "final-topsheet",
    division_id: String(params.division_id),
    period_from: params.period_from,
    period_to: params.period_to,
  });

  return apiFetch<FinalTopSheetResponse>(`${BASE}?${qs.toString()}`);
}

export async function submitFinalHeaderDecision(
  payload: FinalHeaderDecisionPayload
): Promise<{ ok: boolean; message: string; updated_count: number; affected_encoder_count?: number; affected_encoder_ids?: number[] }> {
  return apiFetch<{ ok: boolean; message: string; updated_count: number; affected_encoder_count?: number; affected_encoder_ids?: number[] }>(BASE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
