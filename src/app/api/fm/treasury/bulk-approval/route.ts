// src/app/api/fm/treasury/bulk-approval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { 
  DirectusDisbursementPayableDraft, 
  DirectusExpenseDraft, 
  DirectusExpenseDraftLog 
} from "@/modules/financial-management/treasury/salesmen-expense-approval/type";

export const runtime = "nodejs";

const DIRECTUS_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";
const COOKIE_NAME = "vos_access_token";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (STATIC_TOKEN) h.Authorization = `Bearer ${STATIC_TOKEN}`;
  return { ...h, ...extra };
}

async function directusFetch(path: string, init?: RequestInit) {
  if (!DIRECTUS_BASE)
    return { ok: false, status: 500, data: { error: "NEXT_PUBLIC_API_BASE_URL not set" } };

  const cookieStore = await cookies();
  const userToken = cookieStore.get(COOKIE_NAME)?.value;
  
  // Use static token if provided, but if forced userToken or static fails, try userToken
  const computedHeaders: Record<string, string> = { ...authHeaders(), ...(init?.headers as Record<string, string> || {}) };
  
  const headers = init?.headers as Record<string, string | boolean | undefined>;
  if (headers?.["X-Force-User-Token"] || (!computedHeaders.Authorization && userToken)) {
    computedHeaders.Authorization = `Bearer ${userToken}`;
    delete (computedHeaders as Record<string, unknown>)["X-Force-User-Token"];
  }

  const url = `${DIRECTUS_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  let res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: computedHeaders,
  });

  // FALLBACK: if 403 and we didn't try the userToken yet, try it!
  const hMap = init?.headers as Record<string, unknown>;
  if (!res.ok && res.status === 403 && userToken && !hMap?.["X-Force-User-Token"]) {
    res = await fetch(url, {
      cache: "no-store",
      ...init,
      headers: { ...computedHeaders, Authorization: `Bearer ${userToken}` },
    });
  }

  let data: unknown = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json();
  else data = await res.text();
  return { ok: res.ok, status: res.status, data };
}

function decodeJwtSub(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8")
    ) as Record<string, unknown>;
    const sub = payload["sub"] ?? payload["user_id"] ?? payload["id"];
    const n = Number(sub);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Robustly convert a Directus return value (primitive or object) into a numeric ID. */
function toNumericId(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (!isNaN(n) && val.trim() !== "") return n;
    return null;
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const id = obj.id ?? obj.user_id ?? obj.coa_id ?? obj.expense_id ?? obj.value;
    return toNumericId(id);
  }
  return null;
}

/** Robustly extract a File UUID from a Directus field value. */
function resolveAttachmentId(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val.trim() || null;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const id = obj.id ?? obj.uuid ?? obj.directus_files_id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function nowManila(): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Manila" })
    .replace(" ", "T");
}

function parseTier(status: string): number {
  if (!status) return 1;
  const s = status.toUpperCase();
  if (s === "SUBMITTED") return 1;
  const m = s.match(/PENDING_L(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 1;
}

function tierStatus(tier: number): string {
  if (tier <= 1) return "Submitted";
  return `Pending_L${tier}`;
}

async function getCurrentUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  return token ? decodeJwtSub(token) : null;
}

async function getApproverRecords(userId: number): Promise<
  Array<{
    id: number;
    approver_id: number;
    division_id: number;
    approver_heirarchy: number;
  }>
> {
  const res = await directusFetch(
    `/items/disbursement_draft_approver?filter[approver_id][_eq]=${userId}&filter[is_deleted][_eq]=0&fields=id,approver_id,division_id,approver_heirarchy&limit=-1&sort=-id`
  );
  if (!res.ok) return [];
  const rows = (res.data as { data?: Record<string, unknown>[] })?.data ?? [];
  return rows.map((r) => ({
    id: Number(r.id),
    approver_id: Number(r.approver_id),
    division_id: Number(r.division_id),
    approver_heirarchy: Number(r.approver_heirarchy),
  }));
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return json({ error: "Unauthorized" }, { status: 401 });


    const approverRecords = await getApproverRecords(currentUserId);
    if (!approverRecords.length)
      return json({ error: "Forbidden" }, { status: 403 });

    const levelsByDivision: Record<number, number[]> = {};
    for (const r of approverRecords) {
      if (!levelsByDivision[r.division_id]) levelsByDivision[r.division_id] = [];
      levelsByDivision[r.division_id].push(r.approver_heirarchy);
    }
    const myDivisionIds = [...new Set(approverRecords.map((r) => r.division_id))];
    const myLevel = approverRecords.reduce((min, r) => Math.min(min, r.approver_heirarchy), 99);

    const sp = req.nextUrl.searchParams;
    const resource = sp.get("resource") || "drafts";

    // ── my-access ───────────────────────────────────────────────────────────
    if (resource === "my-access") {
      return json({ data: approverRecords });
    }

    // ── debug ────────────────────────────────────────────────────────────────
    if (resource === "debug") {
      const allDraftsRes = await directusFetch(
        `/items/disbursement_draft?fields=id,doc_no,status,approval_version,division_id,date_created&sort=-id&limit=20`
      );
      return json({
        debug: true,
        my_user_id: currentUserId,
        my_approver_records: approverRecords,
        my_division_ids: myDivisionIds,
        my_level: myLevel,
        all_recent_drafts: (allDraftsRes.data as { data?: unknown[] })?.data ?? [],
      });
    }

    // ── drafts ───────────────────────────────────────────────────────────────
    if (resource === "drafts") {
      if (myDivisionIds.length === 0) return json({ data: [], myLevel, levelsByDivision });

      const queryParams = new URLSearchParams({
        fields: "id,doc_no,payee,total_amount,remarks,status,approval_version,transaction_date,division_id,transaction_type,encoder_id,approver_id,date_created",
        sort: "-id",
        limit: "-1"
      });
      queryParams.set("filter", JSON.stringify({ division_id: { _in: myDivisionIds } }));

      const draftsRes = await directusFetch(
        `/items/disbursement_draft?${queryParams.toString()}`
      );
      
      let drafts = (((draftsRes.data as { data?: unknown[] })?.data) ?? []) as Record<string, unknown>[];

      // 2. In-memory filter based on user's authorized divisions
      // We show ALL active drafts (Submitted, Pending_*) for their divisions
      // The UI will handle disabling the 'Vote Now' button if it hasn't reached their tier yet.
      drafts = drafts.filter(d => {
        const divId = Number(d.division_id);
        const levels = levelsByDivision[divId] || [];
        if (!levels.length) return false;
        
        const status = String(d.status ?? "");
        return status === "Submitted" || status.startsWith("Pending_");
      });

      if (!drafts.length) return json({ data: [], myLevel, levelsByDivision });

      // Resolve user and supplier names
      const uids = new Set<number>();
      const supplierIds = new Set<number>();
      for (const d of drafts as Record<string, unknown>[]) {
        if (d.encoder_id) uids.add(Number(d.encoder_id));
        if (d.payee) {
          uids.add(Number(d.payee)); // Add to both for maximum fallback tolerance
          supplierIds.add(Number(d.payee));
        }
      }

      const userMap: Record<number, string> = {};
      if (uids.size > 0) {
        const uRes = await directusFetch(
          `/items/user?filter[user_id][_in]=${[...uids].join(",")}&fields=user_id,user_fname,user_lname&limit=-1`
        );
        for (const u of (uRes.data as { data?: Record<string, unknown>[] })
          ?.data ?? []) {
          userMap[Number(u.user_id)] =
            `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim();
        }
      }

      const supplierMap: Record<number, string> = {};
      if (supplierIds.size > 0) {
        const sRes = await directusFetch(
          `/items/suppliers?filter[id][_in]=${[...supplierIds].join(",")}&fields=id,supplier_name&limit=-1`
        );
        for (const s of (sRes.data as { data?: Record<string, unknown>[] })?.data ?? []) {
          supplierMap[Number(s.id)] = String(s.supplier_name ?? "");
        }
      }

      // Fetch all divisions for mapping
      const divisionMap: Record<number, string> = {};
      const dRes = await directusFetch(`/items/divisions?fields=id,name&limit=-1`);
      if (dRes.ok) {
        for (const d of (dRes.data as { data?: Record<string, unknown>[] })?.data ?? []) {
          divisionMap[Number(d.id)] = String(d.name ?? "");
        }
      }

      // Fetch all votes for these drafts
      const draftIds = drafts.map((d) => Number(d.id));
      let allVotes: Record<string, unknown>[] = [];
      if (draftIds.length > 0) {
        const votesRes = await directusFetch(
          `/items/disbursement_draft_approvals?filter[draft_id][_in]=${draftIds.join(",")}&fields=id,draft_id,approver_id,status,version,created_at&limit=-1`
        );
        if (votesRes.ok) {
          allVotes =
            (votesRes.data as { data?: Record<string, unknown>[] })?.data ?? [];
        }
      }

      // 2. Fetch all approver structures for ALL relevant divisions to calculate per-row metadata
      const approversRes = await directusFetch(
        `/items/disbursement_draft_approver?filter[division_id][_in]=${myDivisionIds.join(",")}&filter[is_deleted][_eq]=0&fields=approver_id,approver_heirarchy,division_id&limit=-1`
      );
      const allApproversData = (((approversRes.data as { data?: unknown[] })?.data) ?? []) as Record<string, unknown>[];
      
      // Build a per-division metadata map
      const divMetadata: Record<number, { maxLevel: number; approversPerLevel: Record<number, number> }> = {};
      for (const divId of myDivisionIds) {
        const divApprovers = allApproversData.filter(a => Number(a.division_id) === divId);
        const maxLevel = divApprovers.reduce((m, a) => Math.max(m, Number(a.approver_heirarchy ?? 1)), 1);
        const approversPerLevel: Record<number, number> = {};
        for (const a of divApprovers) {
          const lvl = Number(a.approver_heirarchy ?? 1);
          approversPerLevel[lvl] = (approversPerLevel[lvl] || 0) + 1;
        }
        divMetadata[divId] = { maxLevel, approversPerLevel };
      }

      // Group votes by draft
      const votesByDraft: Record<number, Record<string, unknown>[]> = {};
      for (const v of allVotes) {
        const did = Number(v.draft_id);
        if (!votesByDraft[did]) votesByDraft[did] = [];
        votesByDraft[did].push(v);
      }

      const enriched = (drafts as Record<string, unknown>[]).map((d) => {
        const draftId = Number(d.id);
        const currentTier = parseTier(String(d.status ?? "Submitted"));
        const currentVersion = Number(d.approval_version ?? 1);
        const votes = votesByDraft[draftId] || [];

        // Only votes matching current approval_version are "active"
        const currentVotes = votes.filter(
          (v) => Number(v.version) === currentVersion && String(v.status) !== "DRAFT"
        );
        const myVote = currentVotes.find(
          (v) => Number(v.approver_id) === currentUserId
        );

        return {
          id: draftId,
          doc_no: d.doc_no,
          payee_user_id: d.payee,
          payee_name: Number(d.transaction_type) === 2
            ? userMap[Number(d.encoder_id)] || userMap[Number(d.payee)] || supplierMap[Number(d.payee)] || `Salesman #${d.encoder_id || d.payee || '?'}`
            : supplierMap[Number(d.payee)] || userMap[Number(d.payee)] || userMap[Number(d.encoder_id)] || `Unknown Payee`,
          encoder_name:
            userMap[Number(d.encoder_id)] || `User #${d.encoder_id}`,
          total_amount: d.total_amount,
          remarks: d.remarks,
          status: d.status,
          division_name: divisionMap[Number(d.division_id)] || `Div ${d.division_id}`,
          approval_version: currentVersion,
          transaction_date: d.transaction_date,
          date_created: d.date_created,
          current_tier: currentTier,
          max_level: (divMetadata[Number(d.division_id)]?.maxLevel) ?? 1,
          approvers_per_level: (divMetadata[Number(d.division_id)]?.approversPerLevel) ?? {},
          approvers_per_level_orig: (divMetadata[Number(d.division_id)]?.approversPerLevel) ?? {}, // for debugging
          my_vote: myVote
            ? { status: myVote.status, created_at: myVote.created_at, version: myVote.version }
            : null,
          can_vote: (levelsByDivision[Number(d.division_id)] || []).includes(currentTier) && !myVote,
        };
      });

      return json({ 
        data: enriched, 
        myLevel, 
        levelsByDivision 
      });
    }

    // ── draft-detail ─────────────────────────────────────────────────────────
    if (resource === "draft-detail") {
      const draftId = sp.get("draft_id");
      if (!draftId) return json({ error: "draft_id required" }, { status: 400 });

      const dRes = await directusFetch(
        `/items/disbursement_draft?filter[id][_eq]=${draftId}&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,transaction_date,division_id,encoder_id,approver_id,date_created,transaction_type&limit=1`
      );
      if (!dRes.ok) return json(dRes.data, { status: dRes.status });
      const draft = (
        (dRes.data as { data?: unknown[] })?.data ?? []
      )[0] as Record<string, unknown> | undefined;
      if (!draft) return json({ error: "Draft not found" }, { status: 404 });

      const draftDivId = Number(draft.division_id);
      if (!myDivisionIds.includes(draftDivId)) {
        return json({ error: "Access denied" }, { status: 403 });
      }

      const currentVersion = Number(draft.approval_version ?? 1);

      // Payables
      const pRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=id,coa_id,amount,remarks,date,reference_no,expense_id.*&limit=-1`
      );
      
      let debugPayablesError = null;
      if (!pRes.ok) {
        debugPayablesError = pRes.data;
      }

      const payablesUnresolved =
        (pRes.data as { data?: unknown[] })?.data ?? ([] as Record<string, unknown>[]);

      // ── LOGS: Fetch disbursement_draft_logs & draft_payable logs ──
      const dlogRes = await directusFetch(
        `/items/disbursement_draft_logs?filter[draft_id][_eq]=${draftId}&sort=-created_at&fields=log_id,editor_id,edit_reason,payload_snapshot,created_at&limit=-1`
      );
      const rawDraftLogs = (dlogRes.data as { data?: Record<string, unknown>[] })?.data ?? [];
      const logIds = rawDraftLogs.map((l) => Number(l.log_id));
      
      let rawPayableLogs: Record<string, unknown>[] = [];
      if (logIds.length > 0) {
        const plogRes = await directusFetch(
          `/items/disbursement_payables_draft_logs?filter[log_id][_in]=${logIds.join(",")}&fields=id,log_id,coa_id,original_amount,new_amount,remarks,date,reference_no&limit=-1`
        );
        rawPayableLogs = (plogRes.data as { data?: Record<string, unknown>[] })?.data ?? [];
      }

      // ── EXPENSE LOGS: Fetch expense_draft_logs for underlying active expenses ──
      const activeExpenseIds = [
        ...new Set(
          (payablesUnresolved as Record<string, unknown>[])
            .map((p) => toNumericId(p.expense_id))
            .filter((id): id is number => id !== null)
        ),
      ];
      
      let rawExpenseLogs: DirectusExpenseDraftLog[] = [];
      const expenseAttachmentMap: Record<number, string | null> = {};

      if (activeExpenseIds.length > 0) {
        const [eLogRes, eDraftRes] = await Promise.all([
          directusFetch(
            `/items/expense_draft_logs?filter[expense_id][_in]=${activeExpenseIds.join(",")}&sort=-changed_at&fields=log_id,expense_id,action,changed_by,changed_at,amount,remarks,particulars,status&limit=-1`
          ),
          directusFetch(
            `/items/expense_draft?filter[id][_in]=${activeExpenseIds.join(",")}&fields=id,attachment_url,attatchment_url&limit=-1`
          )
        ]);

        rawExpenseLogs = (eLogRes.data as { data?: DirectusExpenseDraftLog[] })?.data ?? [];
        const expenseDrafts = (eDraftRes.data as { data?: DirectusExpenseDraft[] })?.data ?? [];
        
        expenseDrafts.forEach((ed: DirectusExpenseDraft) => {
          const aid = resolveAttachmentId(ed.attachment_url) || resolveAttachmentId(ed.attatchment_url);
          if (aid) expenseAttachmentMap[toNumericId(ed.id) ?? -1] = aid;
        });

        // Backup plan: if drafts failed but logs worked, try to get IDs from logs too (if they exist there)
        if (expenseDrafts.length === 0) {
          rawExpenseLogs.forEach((log: DirectusExpenseDraftLog) => {
            const eid = toNumericId(log.expense_id);
            if (eid !== null && !expenseAttachmentMap[eid]) {
               const aid = resolveAttachmentId(log.attachment_url) || resolveAttachmentId(log.attatchment_url);
               if (aid) expenseAttachmentMap[eid] = aid;
            }
          });
        }
      }

      // COA names
      const coaIds = [
        ...new Set([
          ...(payablesUnresolved as Record<string, unknown>[]).map((p) => Number(p.coa_id)),
          ...rawPayableLogs.map((p) => Number(p.coa_id)),
          ...rawExpenseLogs.map((p) => Number(p.particulars)),
        ].filter(Boolean)),
      ];
      let coaMap: Record<number, string> = {};
      if (coaIds.length > 0) {
        const cRes = await directusFetch(
          `/items/chart_of_accounts?filter[coa_id][_in]=${coaIds.join(",")}&fields=coa_id,account_title&limit=-1`
        );
        coaMap = Object.fromEntries(
          (
            (cRes.data as { data?: Record<string, unknown>[] })?.data ?? []
          ).map((c) => [Number(c.coa_id), String(c.account_title ?? "")])
        );
      }

      // ALL votes for this draft (all versions) — for historical display
      const votesRes = await directusFetch(
        `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${draftId}&fields=id,approver_id,status,remarks,version,created_at&sort=version,created_at&limit=-1`
      );
      const allVotes =
        (votesRes.data as { data?: unknown[] })?.data ?? ([] as Record<string, unknown>[]);

      // All approvers for this division
      const approversRes = await directusFetch(
        `/items/disbursement_draft_approver?filter[division_id][_eq]=${draftDivId}&filter[is_deleted][_eq]=0&fields=id,approver_id,approver_heirarchy&limit=-1&sort=approver_heirarchy`
      );
      const allApprovers =
        (approversRes.data as { data?: unknown[] })?.data ?? ([] as Record<string, unknown>[]);

      // Resolve user and supplier names
      const uids = new Set<number>();
      const supplierIds = new Set<number>();

      for (const a of allApprovers as Record<string, unknown>[])
        uids.add(Number(a.approver_id));
      for (const v of allVotes as Record<string, unknown>[])
        uids.add(Number(v.approver_id));
      for (const l of rawDraftLogs)
        if (l.editor_id) uids.add(Number(l.editor_id));
      for (const e of rawExpenseLogs)
        if (e.changed_by) uids.add(Number(e.changed_by));

      if (draft.encoder_id) uids.add(Number(draft.encoder_id));
      if (draft.payee) {
        uids.add(Number(draft.payee));
        supplierIds.add(Number(draft.payee));
      }

      const userMap: Record<number, string> = {};
      if (uids.size > 0) {
        const uRes = await directusFetch(
          `/items/user?filter[user_id][_in]=${[...uids].join(",")}&fields=user_id,user_fname,user_lname&limit=-1`
        );
        for (const u of (uRes.data as { data?: Record<string, unknown>[] })
          ?.data ?? []) {
          userMap[Number(u.user_id)] =
            `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim();
        }
      }

      const supplierMap: Record<number, string> = {};
      if (supplierIds.size > 0) {
        const sRes = await directusFetch(
          `/items/suppliers?filter[id][_in]=${[...supplierIds].join(",")}&fields=id,supplier_name&limit=-1`
        );
        for (const s of (sRes.data as { data?: Record<string, unknown>[] })?.data ?? []) {
          supplierMap[Number(s.id)] = String(s.supplier_name ?? "");
        }
      }

      const currentTier = parseTier(String(draft.status ?? "Submitted"));
      const maxLevel = (allApprovers as Record<string, unknown>[]).reduce(
        (m, a) => Math.max(m, Number(a.approver_heirarchy ?? 1)),
        1
      );

      // Current-version votes only (for active tier display + can_vote)
      const currentVoteByApprover: Record<number, Record<string, unknown>> = {};
      for (const v of allVotes as Record<string, unknown>[]) {
        if (Number(v.version) === currentVersion && String(v.status) !== "DRAFT") {
          currentVoteByApprover[Number(v.approver_id)] = v;
        }
      }

      // Group current votes by level
      const approversByLevel: Record<
        number,
        {
          approver_id: number;
          name: string;
          level: number;
          vote: { status: string; remarks: string | null; created_at: string; version: number } | null;
        }[]
      > = {};
      for (const a of allApprovers as Record<string, unknown>[]) {
        const lvl = Number(a.approver_heirarchy ?? 1);
        const aid = Number(a.approver_id);
        const vote = currentVoteByApprover[aid];
        if (!approversByLevel[lvl]) approversByLevel[lvl] = [];
        approversByLevel[lvl].push({
          approver_id: aid,
          name: userMap[aid] || `User #${aid}`,
          level: lvl,
          vote: vote
            ? {
                status: String(vote.status ?? ""),
                remarks: vote.remarks ? String(vote.remarks) : null,
                created_at: String(vote.created_at ?? ""),
                version: Number(vote.version),
              }
            : null,
        });
      }

      // Historical rounds — group by version, show all votes
      const versionSet = [
        ...new Set(
          (allVotes as Record<string, unknown>[]).map((v) => Number(v.version))
        ),
      ].sort((a, b) => a - b);

      const voteHistory = versionSet.map((ver) => {
        const roundVotes = (allVotes as Record<string, unknown>[]).filter(
          (v) => Number(v.version) === ver
        );
        const outcome = roundVotes.some((v) => String(v.status) === "REJECTED")
          ? "REJECTED"
          : roundVotes.some((v) => String(v.status) === "APPROVED")
          ? "IN_PROGRESS"
          : "PENDING";
        return {
          version: ver,
          is_current: ver === currentVersion,
          outcome,
          votes: roundVotes.map((v) => ({
            approver_id: Number(v.approver_id),
            name: userMap[Number(v.approver_id)] || `User #${v.approver_id}`,
            status: String(v.status),
            remarks: v.remarks ? String(v.remarks) : null,
            created_at: String(v.created_at ?? ""),
          })),
        };
      });

      const myVote = currentVoteByApprover[currentUserId];

      const formattedLogs = rawDraftLogs.map((l) => {
        let snapshot = { old_total: 0, new_total: 0 };
        try { snapshot = JSON.parse(String(l.payload_snapshot || "{}")); } catch {}

        const pLogs = rawPayableLogs
          .filter(p => Number(p.log_id) === Number(l.log_id))
          .map(p => ({
            coa_id: Number(p.coa_id),
            coa_name: coaMap[Number(p.coa_id)] || `COA #${p.coa_id}`,
            original_amount: Number(p.original_amount),
            new_amount: Number(p.new_amount),
            remarks: p.remarks ? String(p.remarks) : null,
            date: p.date ? String(p.date) : null,
            reference_no: p.reference_no ? String(p.reference_no) : null,
          }));

        return {
          id: Number(l.log_id),
          editor_name: userMap[Number(l.editor_id)] || `User #${l.editor_id}`,
          edit_reason: String(l.edit_reason || "Unknown reason"),
          old_total: Number(snapshot.old_total || 0),
          new_total: Number(snapshot.new_total || 0),
          created_at: String(l.created_at || ""),
          payables: pLogs,
        };
      });

      const formattedExpenseLogs = rawExpenseLogs.map((l) => ({
        id: Number(l.log_id),
        expense_id: Number(l.expense_id),
        action: String(l.action || ""),
        editor_name: userMap[Number(l.changed_by)] || `User #${l.changed_by}`,
        changed_at: String(l.changed_at || ""),
        amount: Number(l.amount || 0),
        remarks: l.remarks ? String(l.remarks) : null,
        particulars: coaMap[Number(l.particulars)] || String(l.particulars || ""),
        status: String(l.status || ""),
      }));

      return json({
        draft: {
          ...draft,
          payee_name: Number(draft.transaction_type) === 2
            ? userMap[Number(draft.encoder_id)] || userMap[Number(draft.payee)] || supplierMap[Number(draft.payee)] || `Salesman #${draft.encoder_id || draft.payee || '?'}`
            : supplierMap[Number(draft.payee)] || userMap[Number(draft.payee)] || userMap[Number(draft.encoder_id)] || `Unknown Payee`,
          encoder_name:
            userMap[Number(draft.encoder_id)] || `User #${draft.encoder_id}`,
          current_tier: currentTier,
          max_level: maxLevel,
          approval_version: currentVersion,
        },
        _debug_payables_error: debugPayablesError,
        payables: (payablesUnresolved as Record<string, unknown>[]).map((p) => ({
          id: p.id,
          coa_id: p.coa_id,
          coa_name: coaMap[Number(p.coa_id)] || `COA #${p.coa_id}`,
          amount: p.amount,
          remarks: p.remarks,
          date: p.date,
          reference_no: p.reference_no,
          attachment_url: resolveAttachmentId((p as unknown as DirectusDisbursementPayableDraft).expense_id && typeof (p as unknown as DirectusDisbursementPayableDraft).expense_id === 'object' ? ((p as unknown as DirectusDisbursementPayableDraft).expense_id as { attachment_url?: string }).attachment_url : null) || 
                          resolveAttachmentId((p as unknown as DirectusDisbursementPayableDraft).expense_id && typeof (p as unknown as DirectusDisbursementPayableDraft).expense_id === 'object' ? ((p as unknown as DirectusDisbursementPayableDraft).expense_id as { attatchment_url?: string }).attatchment_url : null) || 
                          null,
        })),
        approvers_by_level: approversByLevel,
        vote_history: voteHistory,
        logs: formattedLogs,
        expense_logs: formattedExpenseLogs,
        my_level: (levelsByDivision[draftDivId] || []).includes(currentTier) 
          ? currentTier 
          : ((levelsByDivision[draftDivId] || [])[0] ?? myLevel),
        my_vote: myVote
          ? {
              status: String(myVote.status ?? ""),
              remarks: myVote.remarks ? String(myVote.remarks) : null,
              created_at: String(myVote.created_at ?? ""),
              version: Number(myVote.version),
            }
          : null,
        can_vote: (levelsByDivision[draftDivId] || []).includes(currentTier) && !myVote,
      });
    }

    // ── logs ─────────────────────────────────────────────────────────────────
    if (resource === "logs") {
      // Query by DIVISION — not by user vote — so every level sees the same history
      // L1, L2, L3... all see all drafts in their authorized division(s)
      const divisionDraftQueries = myDivisionIds.map((divId) =>
        directusFetch(
          `/items/disbursement_draft?filter[division_id][_eq]=${divId}` +
          `&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,transaction_date,date_created,encoder_id,division_id,transaction_type` +
          `&sort=-id&limit=-1`
        )
      );
      const draftResults = await Promise.all(divisionDraftQueries);

      // Merge + deduplicate across divisions
      const seen = new Set<number>();
      const draftRows: Record<string, unknown>[] = [];
      for (const res of draftResults) {
        if (!res.ok) continue;
        for (const row of (res.data as { data?: Record<string, unknown>[] })?.data ?? []) {
          const id = Number(row.id);
          if (!seen.has(id)) { seen.add(id); draftRows.push(row); }
        }
      }

      if (!draftRows.length) return json({ data: [] });

      const draftIds = draftRows.map((d) => Number(d.id));

      // Fetch ALL approval votes for these drafts (all approvers, all versions)
      const allVotesRes = await directusFetch(
        `/items/disbursement_draft_approvals?filter[draft_id][_in]=${draftIds.join(",")}&fields=id,draft_id,approver_id,status,remarks,version,created_at&sort=version,created_at&limit=-1`
      );
      const allVotes = (
        (allVotesRes.data as { data?: Record<string, unknown>[] })?.data ?? []
      ).filter((v) => String(v.status) !== "DRAFT");

      // Approver level map: approver_id → hierarchy level
      const approverLevelMap: Record<number, number> = {};
      await Promise.all(
        myDivisionIds.map(async (divId) => {
          const aRes = await directusFetch(
            `/items/disbursement_draft_approver?filter[division_id][_eq]=${divId}&filter[is_deleted][_eq]=0&fields=approver_id,approver_heirarchy&limit=-1`
          );
          for (const a of (aRes.data as { data?: Record<string, unknown>[] })?.data ?? []) {
            approverLevelMap[Number(a.approver_id)] = Number(a.approver_heirarchy);
          }
        })
      );

      // Resolve all relevant user and supplier names
      const uids = new Set<number>();
      const supplierIds = new Set<number>();

      for (const d of draftRows) {
        if (d.encoder_id) uids.add(Number(d.encoder_id));
        if (d.payee) {
          uids.add(Number(d.payee));
          supplierIds.add(Number(d.payee));
        }
      }
      for (const v of allVotes) {
        if (v.approver_id) uids.add(Number(v.approver_id));
      }

      const userMap: Record<number, string> = {};
      if (uids.size > 0) {
        const uRes = await directusFetch(
          `/items/user?filter[user_id][_in]=${[...uids].join(",")}&fields=user_id,user_fname,user_lname&limit=-1`
        );
        for (const u of (uRes.data as { data?: Record<string, unknown>[] })?.data ?? []) {
          userMap[Number(u.user_id)] = `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim();
        }
      }

      const supplierMap: Record<number, string> = {};
      if (supplierIds.size > 0) {
        const sRes = await directusFetch(
          `/items/suppliers?filter[id][_in]=${[...supplierIds].join(",")}&fields=id,supplier_name&limit=-1`
        );
        for (const s of (sRes.data as { data?: Record<string, unknown>[] })?.data ?? []) {
          supplierMap[Number(s.id)] = String(s.supplier_name ?? "");
        }
      }

      // Group votes by draft_id
      const votesByDraft: Record<number, Record<string, unknown>[]> = {};
      for (const v of allVotes) {
        const did = Number(v.draft_id);
        if (!votesByDraft[did]) votesByDraft[did] = [];
        votesByDraft[did].push(v);
      }

      // Build draft-centric response — only include drafts that have at least one vote
      const formatted = draftRows
        .filter((d) => (votesByDraft[Number(d.id)] ?? []).length > 0)
        .map((d) => {
          const draftId = Number(d.id);
          const currentVersion = Number(d.approval_version ?? 1);
          const votes = votesByDraft[draftId] ?? [];

          const versionSet = [
            ...new Set(votes.map((v) => Number(v.version))),
          ].sort((a, b) => a - b);

          const rounds = versionSet.map((ver) => {
            const roundVotes = votes
              .filter((v) => Number(v.version) === ver)
              .map((v) => ({
                approver_id: Number(v.approver_id),
                name: userMap[Number(v.approver_id)] || `User #${v.approver_id}`,
                level: approverLevelMap[Number(v.approver_id)] ?? 0,
                status: String(v.status),
                remarks: v.remarks ? String(v.remarks) : null,
                created_at: String(v.created_at ?? ""),
              }))
              .sort((a, b) => a.level - b.level);

            const hasRejection = roundVotes.some((v) => v.status === "REJECTED");
            const isFinalApproved =
              String(d.status) === "Approved" && ver === currentVersion && !hasRejection;

            const outcome = isFinalApproved
              ? "FINAL_APPROVED"
              : hasRejection
              ? "REJECTED"
              : ver < currentVersion
              ? "SUPERSEDED"
              : "IN_PROGRESS";

            return { version: ver, is_current: ver === currentVersion, outcome, votes: roundVotes };
          });

          return {
            id: draftId,
            doc_no: d.doc_no,
            payee_name: Number(d.transaction_type) === 2
              ? userMap[Number(d.encoder_id)] || userMap[Number(d.payee)] || supplierMap[Number(d.payee)] || `Salesman #${d.encoder_id || d.payee || '?'}`
              : supplierMap[Number(d.payee)] || userMap[Number(d.payee)] || userMap[Number(d.encoder_id)] || `Unknown Payee`,
            encoder_name: userMap[Number(d.encoder_id)] || `User #${d.encoder_id}`,
            total_amount: d.total_amount,
            remarks: d.remarks,
            status: d.status,
            approval_version: currentVersion,
            transaction_date: d.transaction_date,
            date_created: d.date_created,
            rounds,
          };
        });

      return json({ data: formatted });
    }

    // ── log-detail ───────────────────────────────────────────────────────────

    if (resource === "log-detail") {
      const draftId = sp.get("draft_id");
      if (!draftId) return json({ error: "draft_id required" }, { status: 400 });

      const pRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=id,coa_id,amount,remarks,date&limit=-1`
      );
      const payables =
        (pRes.data as { data?: unknown[] })?.data ?? ([] as Record<string, unknown>[]);
      const coaIds = [
        ...new Set(
          (payables as Record<string, unknown>[])
            .map((p) => Number(p.coa_id))
            .filter(Boolean)
        ),
      ];
      let coaMap: Record<number, string> = {};
      if (coaIds.length > 0) {
        const cRes = await directusFetch(
          `/items/chart_of_accounts?filter[coa_id][_in]=${coaIds.join(",")}&fields=coa_id,account_title&limit=-1`
        );
        coaMap = Object.fromEntries(
          (
            (cRes.data as { data?: Record<string, unknown>[] })?.data ?? []
          ).map((c) => [Number(c.coa_id), String(c.account_title ?? "")])
        );
      }
      return json({
        data: (payables as Record<string, unknown>[]).map((p) => ({
          id: p.id,
          coa_name: coaMap[Number(p.coa_id)] || `COA #${p.coa_id}`,
          amount: p.amount,
          remarks: p.remarks,
          date: p.date,
        })),
      });
    }

    return json({ error: "Unknown resource" }, { status: 400 });
  } catch (e: unknown) {
    return json(
      { error: "Server error", message: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}

// ─── POST (vote submission) ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      draft_id: number;
      status: "APPROVED" | "REJECTED";
      remarks?: string;
      edited_payables?: { id: number; amount: string | number }[];
    };
    const { draft_id, status, remarks, edited_payables } = body;

    if (!draft_id || !status)
      return json({ error: "draft_id and status are required" }, { status: 400 });

    if (status === "REJECTED" && (!remarks || remarks.trim().length < 10)) {
      return json(
        { error: "Rejection reason is mandatory (minimum 10 characters)." },
        { status: 400 }
      );
    }

    // Identify approver
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return json({ error: "Unauthorized" }, { status: 401 });

    const approverRecords = await getApproverRecords(currentUserId);
    if (!approverRecords.length)
      return json({ error: "Forbidden: Not an authorized approver" }, { status: 403 });

    const myDivisionIds = [...new Set(approverRecords.map((r) => r.division_id))];

    // Fetch draft (incl. approval_version and content version)
    const draftRes = await directusFetch(
      `/items/disbursement_draft?filter[id][_eq]=${draft_id}&fields=id,doc_no,status,approval_version,version,payee,total_amount,remarks,transaction_date,division_id,department_id,encoder_id,transaction_type,supporting_documents_url&limit=1`
    );
    if (!draftRes.ok) return json(draftRes.data, { status: draftRes.status });
    const draft = (
      (draftRes.data as { data?: unknown[] })?.data ?? []
    )[0] as Record<string, unknown> | undefined;
    if (!draft) return json({ error: "Draft not found" }, { status: 404 });

    const draftDivId = Number(draft.division_id);
    if (!myDivisionIds.includes(draftDivId)) {
      return json({ error: "Access denied: not your division" }, { status: 403 });
    }

    const currentVersion = Number(draft.approval_version ?? 1);
    const currentTier = parseTier(String(draft.status ?? "Submitted"));

    // Level check: check if the user is authorized for the current draft's tier in its division
    const authorizedLevelsInThisDivision = approverRecords
      .filter(r => r.division_id === draftDivId)
      .map(r => r.approver_heirarchy);

    if (!authorizedLevelsInThisDivision.includes(currentTier)) {
      return json(
        {
          error: `You cannot vote now. Active tier: ${currentTier}. Your authorized levels in this division: ${authorizedLevelsInThisDivision.join(", ") || "None"}.`,
        },
        { status: 403 }
      );
    }

    // Duplicate vote check — only for current version
    const existingVoteRes = await directusFetch(
      `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${draft_id}&filter[approver_id][_eq]=${currentUserId}&filter[version][_eq]=${currentVersion}&fields=id,status&limit=1`
    );
    const existingVote = (
      (existingVoteRes.data as { data?: Record<string, unknown>[] })?.data ?? []
    )[0];
    if (existingVote && String(existingVote.status) !== "DRAFT") {
      return json(
        { error: "You have already voted on this draft (current round)." },
        { status: 409 }
      );
    }

    const nowTs = nowManila();
    let finalRemarks = remarks?.trim() || null;

    // ── PROCESS EDITED PAYABLES & LOGGING ───────────────────────────────────────
    if (edited_payables && edited_payables.length > 0) {
      // 1. Fetch current payables to calculate total AND snapshot them
      const pRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draft_id}&fields=id,coa_id,amount,reference_no,remarks,date&limit=-1`
      );
      if (!pRes.ok) return json({ error: "Failed to fetch existing payables for edit." }, { status: 500 });
      
      const existingPayables = (pRes.data as { data?: Record<string, unknown>[] })?.data ?? [];
      const editMap = new Map<number, number>(
        edited_payables.map((ep) => [ep.id, Number(ep.amount)])
      );

      // 2. Calculate new total amount
      let oldTotalAmount = 0;
      let newTotalAmount = 0;
      const patchedPayablesLogPayloads = [];

      for (const ep of existingPayables) {
        const id = Number(ep.id);
        const originalAmount = Number(ep.amount);
        const hasEdit = editMap.has(id);
        const finalAmount = hasEdit ? editMap.get(id)! : originalAmount;
        
        oldTotalAmount += originalAmount;
        newTotalAmount += finalAmount;

        // If it was edited, update it in the DB
        if (hasEdit) {
          await directusFetch(`/items/disbursement_payables_draft/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ amount: finalAmount }),
          });
        }

        // Build log payload for this payable
        patchedPayablesLogPayloads.push({
          payable_draft_id: id,
          disbursement_id: draft_id,
          coa_id: ep.coa_id ? Number(ep.coa_id) : null,
          reference_no: ep.reference_no ? String(ep.reference_no) : null,
          amount: finalAmount,
          remarks: ep.remarks ? String(ep.remarks) : null,
          version: Number(draft.version ?? 1) + 1,
          updated_by: currentUserId,
          log_date: nowTs,
        });
      }

      const contentVersion = Number(draft.version ?? 1) + 1;

      // 3. Update parent draft with new total amount and version
      await directusFetch(`/items/disbursement_draft/${draft_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          total_amount: newTotalAmount,
          version: contentVersion,
        }),
      });

      // 4. Insert Draft Log
      await directusFetch(`/items/disbursement_draft_logs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          disbursement_id: draft_id,
          doc_no: draft.doc_no ? String(draft.doc_no) : null,
          total_amount: newTotalAmount,
          status: String(draft.status ?? "Submitted"),
          remarks: draft.remarks ? String(draft.remarks) : null,
          version: contentVersion,
          updated_by: currentUserId,
          log_date: nowTs,
        }),
      });

      // 5. Insert Payable Logs (bulk)
      await directusFetch(`/items/disbursement_payables_draft_logs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patchedPayablesLogPayloads),
      });

      // Update local draft reference values for any subsequent logic
      draft.total_amount = newTotalAmount;
      draft.version = contentVersion;
      
      const oldFmt = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 }).format(oldTotalAmount);
      const newFmt = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 }).format(newTotalAmount);
      const prefix = `[Adjusted Total: ₱${oldFmt} ➔ ₱${newFmt}]`;
      finalRemarks = finalRemarks ? `${prefix} ${finalRemarks}` : prefix;
    }

    // Insert new vote with approval version
    await directusFetch(`/items/disbursement_draft_approvals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draft_id,
        approver_id: currentUserId,
        status,
        remarks: finalRemarks,
        version: currentVersion,
        created_at: nowTs,
      }),
    });

    // ── REJECTION: increment approval_version, reset draft to Submitted ──────
    // No vote data is touched — history is preserved!
    if (status === "REJECTED") {
      let draftStatus = "Submitted";
      let fallbackMessage = "";

      if (currentTier > 1) {
        // Fallback to previous tier
        const previousTier = currentTier - 1;
        draftStatus = tierStatus(previousTier);
        fallbackMessage = `Draft fell back to Level ${previousTier} (Round ${currentVersion + 1}). Previous votes preserved.`;
      } else {
        // L1 rejection
        if (Number(draft.transaction_type) === 2) {
          draftStatus = "Rejected";

          const payRes = await directusFetch(
            `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draft_id}&fields=expense_id&limit=-1`
          );
          console.log("[DEBUG] Rejection payRes:", payRes);
          const payRows = (payRes.data as { data?: Record<string, unknown>[] })?.data ?? [];
          const expenseIds = payRows.map(r => {
            const raw = r.expense_id;
            if (typeof raw === "object" && raw !== null) return Number((raw as { id: number }).id);
            return Number(raw);
          }).filter(id => !isNaN(id) && id > 0);
          
          console.log("[DEBUG] Extracted expenseIds:", expenseIds);

          if (expenseIds.length > 0) {
            const revertRes = await directusFetch(`/items/expense_draft`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                keys: expenseIds,
                data: { status: "Rejected", rejected_at: nowTs },
              }),
            });
            console.log("[DEBUG] Revert expense_draft response:", revertRes);
          } else {
            console.log("[DEBUG] No valid expenseIds found. Check if the draft was created BEFORE expense_id column was added.");
          }
          fallbackMessage = `Draft rejected (Round ${currentVersion}). Associated expenses returned to Salesman Expense queue.`;
        } else {
          draftStatus = "Submitted";
          fallbackMessage = `Draft rejected (Round ${currentVersion}). Returned to Level 1 for Round ${currentVersion + 1}.`;
        }
      }

      await directusFetch(`/items/disbursement_draft/${draft_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: draftStatus,
          approval_version: currentVersion + 1,
        }),
      });

      return json({
        ok: true,
        result: "REJECTED",
        message: fallbackMessage,
        rejection_round: currentVersion,
        next_round: currentVersion + 1,
      });
    }

    // ── APPROVAL CONSENSUS ────────────────────────────────────────────────────
    const tierApproversRes = await directusFetch(
      `/items/disbursement_draft_approver?filter[division_id][_eq]=${draftDivId}&filter[is_deleted][_eq]=0&filter[approver_heirarchy][_eq]=${currentTier}&fields=approver_id&limit=-1`
    );
    const tierApprovers = (
      (tierApproversRes.data as { data?: unknown[] })?.data ?? []
    ) as Record<string, unknown>[];
    const tierApproverIds = [...new Set(tierApprovers.map((a) => Number(a.approver_id)))];
    const totalInTier = tierApproverIds.length;

    // Count APPROVED votes for the current version at this tier
    const votesInTierRes = await directusFetch(
      `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${draft_id}&filter[status][_eq]=APPROVED&filter[version][_eq]=${currentVersion}&fields=approver_id&limit=-1`
    );
    const votesInTier = (
      (votesInTierRes.data as { data?: Record<string, unknown>[] })?.data ?? []
    ).filter((v) => tierApproverIds.includes(Number(v.approver_id)));
    const approvedInTier = votesInTier.length;

    if (approvedInTier >= totalInTier) {
      // Find max level for this division
      const allApproversRes = await directusFetch(
        `/items/disbursement_draft_approver?filter[division_id][_eq]=${draftDivId}&filter[is_deleted][_eq]=0&fields=approver_id,approver_heirarchy&limit=-1&sort=-approver_heirarchy`
      );
      const allApprovers = (
        allApproversRes.data as { data?: Record<string, unknown>[] }
      )?.data ?? [];
      const maxLevel = allApprovers.reduce(
        (m, a) => Math.max(m, Number(a.approver_heirarchy ?? 1)),
        1
      );
      const nextLevel = currentTier + 1;

      if (nextLevel > maxLevel) {
        // ── ALL TIERS COMPLETE → POST TO LIVE ────────────────────────
        // Remarks = highest-hierarchy approver's vote remarks for this version
        const highestApprover = allApprovers[0]; // sort=-approver_heirarchy
        const highestVoteRes = await directusFetch(
          `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${draft_id}&filter[approver_id][_eq]=${Number(highestApprover?.approver_id)}&filter[status][_eq]=APPROVED&filter[version][_eq]=${currentVersion}&fields=remarks&limit=1`
        );
        const highestVote = (
          (highestVoteRes.data as { data?: Record<string, unknown>[] })?.data ?? []
        )[0];
        const finalRemarks = highestVote?.remarks
          ? String(highestVote.remarks)
          : draft.remarks
          ? String(draft.remarks)
          : null;

        // Parent draft update is done AFTER generating liveDocNo now.

        const payDraftRes = await directusFetch(
          `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draft_id}&fields=id,division_id,reference_no,date,coa_id,amount,remarks&limit=-1`
        );
        const payDraftRows = (
          (payDraftRes.data as { data?: unknown[] })?.data ?? []
        ) as Record<string, unknown>[];

        const latestLiveRes = await directusFetch(
          `/items/disbursement?sort=-id&fields=id,doc_no&limit=1`
        );
        const latestLive = (
          (latestLiveRes.data as { data?: unknown[] })?.data ?? []
        )[0] as Record<string, unknown> | undefined;
        let nextDocNum = 1000;
        if (latestLive?.doc_no) {
          const match = String(latestLive.doc_no).match(/(\d+)/);
          if (match) nextDocNum = parseInt(match[1], 10) + 1;
        }
        const liveDocNo = `NT-${nextDocNum}`;

        // Format supporting documents as comma-separated string
        let finalSupportingDocsUrl = null;
        if (draft.supporting_documents_url) {
          if (Array.isArray(draft.supporting_documents_url)) {
            finalSupportingDocsUrl = draft.supporting_documents_url
              .map((u: unknown) => {
                if (typeof u === "object" && u !== null) {
                  const obj = u as Record<string, unknown>;
                  return obj.directus_files_id || obj.id || obj;
                }
                return u;
              })
              .filter(Boolean)
              .join(",");
          } else if (typeof draft.supporting_documents_url === "string") {
            finalSupportingDocsUrl = draft.supporting_documents_url;
          }
        }

        const liveDisbPayload: Record<string, unknown> = {
          doc_no: liveDocNo,
          transaction_type: Number(draft.transaction_type ?? 2),
          remarks: finalRemarks,
          total_amount: draft.total_amount,
          paid_amount: 0,
          encoder_id: draft.encoder_id,
          approver_id: null,
          posted_by: null,
          transaction_date: draft.transaction_date,
          division_id: draft.division_id,
          department_id: draft.department_id,
          status: "Draft",
          isPosted: 0,
          date_approved: null,
          date_created: nowTs,
          date_updated: nowTs,
          supporting_documents_url: finalSupportingDocsUrl,
        };

        // Update the draft records to correspond with the live one
        await directusFetch(`/items/disbursement_draft/${draft_id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ 
            status: "Approved", 
            doc_no: liveDocNo,
            doc_id: liveDocNo // requested doc_id field as well
          }),
        });

        if (payDraftRows.length > 0) {
          const payDraftIds = payDraftRows.map((p) => Number(p.id));
          await directusFetch(`/items/disbursement_payables_draft`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              keys: payDraftIds,
              data: { reference_no: liveDocNo },
            }),
          });
        }

        // For type 2 (Salesman), payee might be null in draft as they aren't in suppliers table.
        // We only include it if it exists to avoid Directus NOT NULL validation.
        if (draft.payee) {
          liveDisbPayload.payee = draft.payee;
        }

        const liveDisbRes = await directusFetch(`/items/disbursement`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(liveDisbPayload),
        });

        if (!liveDisbRes.ok) {
          return json(
            { error: "Failed to create live disbursement", detail: liveDisbRes.data },
            { status: 500 }
          );
        }

        const liveId = Number(
          ((liveDisbRes.data as { data?: Record<string, unknown> })?.data)?.id ?? 0
        );
        if (!liveId)
          return json(
            { error: "Live disbursement created but no ID returned" },
            { status: 500 }
          );

        if (payDraftRows.length > 0) {
          await directusFetch(`/items/disbursement_payables`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              payDraftRows.map((p) => ({
                disbursement_id: liveId,
                division_id: p.division_id,
                reference_no: liveDocNo,
                date: p.date,
                coa_id: p.coa_id,
                amount: p.amount,
                remarks: p.remarks,
              }))
            ),
          });
        }

        return json({
          ok: true,
          result: "APPROVED",
          message: `All tiers approved (Round ${currentVersion}). Posted as ${liveDocNo}.`,
          live_disbursement_id: liveId,
          doc_no: liveDocNo,
          approval_round: currentVersion,
          final_remarks_from: `Level ${maxLevel} approver`,
        });
      } else {
        // Advance to next tier
        const newStatus = tierStatus(nextLevel);
        await directusFetch(`/items/disbursement_draft/${draft_id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        return json({
          ok: true,
          result: "TIER_ADVANCED",
          message: `Tier ${currentTier} complete. Advancing to Level ${nextLevel}.`,
          next_tier: nextLevel,
        });
      }
    }

    return json({
      ok: true,
      result: "VOTE_RECORDED",
      message: `Vote recorded (Round ${currentVersion}). ${approvedInTier} of ${totalInTier} at Level ${currentTier}.`,
      approved_in_tier: approvedInTier,
      total_in_tier: totalInTier,
    });
  } catch (e: unknown) {
    return json(
      { error: "Server error", message: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}
