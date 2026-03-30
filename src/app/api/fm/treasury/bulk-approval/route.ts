// src/app/api/fm/treasury/bulk-approval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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
  const url = `${DIRECTUS_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> || {}) },
  });
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

async function getApproverRecord(userId: number) {
  const records = await getApproverRecords(userId);
  return records.length ? records[0] : null;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return json({ error: "Unauthorized" }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const resource = sp.get("resource") || "drafts";

    // ── my-access ───────────────────────────────────────────────────────────
    if (resource === "my-access") {
      const approver = await getApproverRecord(currentUserId);
      if (!approver) return json({ error: "Forbidden" }, { status: 403 });
      return json({ data: approver });
    }

    const approverRecords = await getApproverRecords(currentUserId);
    if (!approverRecords.length)
      return json({ error: "Forbidden" }, { status: 403 });

    const myDivisionIds = [...new Set(approverRecords.map((r) => r.division_id))];
    const myLevel = approverRecords.reduce(
      (min, r) => Math.min(min, r.approver_heirarchy),
      99
    );

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
      const activeTierStatus =
        myLevel === 1 ? "Submitted" : `Pending_L${myLevel}`;

      // Fetch pending drafts across all authorized divisions
      const divisionQueries = myDivisionIds.flatMap((divId) => {
        const base =
          `/items/disbursement_draft?filter[division_id][_eq]=${divId}` +
          `&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,transaction_date,division_id,transaction_type,encoder_id,approver_id,date_created` +
          `&sort=-id&limit=-1`;
        const queries = [directusFetch(`${base}&filter[status][_eq]=Submitted`)];
        if (myLevel > 1) {
          queries.push(
            directusFetch(`${base}&filter[status][_eq]=${activeTierStatus}`)
          );
        }
        return queries;
      });

      const allResults = await Promise.all(divisionQueries);
      const seen = new Set<number>();
      const drafts: Record<string, unknown>[] = [];
      for (const res of allResults) {
        if (!res.ok) continue;
        for (const row of (res.data as { data?: Record<string, unknown>[] })
          ?.data ?? []) {
          const rid = Number(row.id);
          if (!seen.has(rid)) {
            seen.add(rid);
            drafts.push(row);
          }
        }
      }

      if (!drafts.length) return json({ data: [], myLevel });

      // Resolve names
      const uids = new Set<number>();
      for (const d of drafts as Record<string, unknown>[]) {
        if (d.payee) uids.add(Number(d.payee));
        if (d.encoder_id) uids.add(Number(d.encoder_id));
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

      // Approvers per level for the first division (for display badges)
      const approversRes = await directusFetch(
        `/items/disbursement_draft_approver?filter[division_id][_eq]=${myDivisionIds[0]}&filter[is_deleted][_eq]=0&fields=approver_id,approver_heirarchy&limit=-1`
      );
      const allApprovers = approversRes.ok
        ? ((approversRes.data as { data?: Record<string, unknown>[] })?.data ?? [])
        : [];
      const maxLevel = allApprovers.reduce(
        (m, a) => Math.max(m, Number(a.approver_heirarchy ?? 1)),
        1
      );
      const approversPerLevel: Record<number, number> = {};
      for (const a of allApprovers) {
        const lvl = Number(a.approver_heirarchy ?? 1);
        approversPerLevel[lvl] = (approversPerLevel[lvl] || 0) + 1;
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
          payee_name: userMap[Number(d.payee)] || `User #${d.payee}`,
          encoder_name:
            userMap[Number(d.encoder_id)] || `User #${d.encoder_id}`,
          total_amount: d.total_amount,
          remarks: d.remarks,
          status: d.status,
          approval_version: currentVersion,
          transaction_date: d.transaction_date,
          date_created: d.date_created,
          current_tier: currentTier,
          max_level: maxLevel,
          approvers_per_level: approversPerLevel,
          my_vote: myVote
            ? { status: myVote.status, created_at: myVote.created_at, version: myVote.version }
            : null,
          can_vote: myLevel === currentTier && !myVote,
        };
      });

      return json({ data: enriched, myLevel });
    }

    // ── draft-detail ─────────────────────────────────────────────────────────
    if (resource === "draft-detail") {
      const draftId = sp.get("draft_id");
      if (!draftId) return json({ error: "draft_id required" }, { status: 400 });

      const dRes = await directusFetch(
        `/items/disbursement_draft?filter[id][_eq]=${draftId}&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,transaction_date,division_id,encoder_id,approver_id,date_created&limit=1`
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
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=id,coa_id,amount,remarks,date,reference_no&limit=-1`
      );
      const payables =
        (pRes.data as { data?: unknown[] })?.data ?? ([] as Record<string, unknown>[]);

      // COA names
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

      // Resolve user names
      const uids = new Set<number>();
      for (const a of allApprovers as Record<string, unknown>[])
        uids.add(Number(a.approver_id));
      for (const v of allVotes as Record<string, unknown>[])
        uids.add(Number(v.approver_id));
      if (draft.payee) uids.add(Number(draft.payee));
      if (draft.encoder_id) uids.add(Number(draft.encoder_id));

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

      return json({
        draft: {
          ...draft,
          payee_name: userMap[Number(draft.payee)] || `User #${draft.payee}`,
          encoder_name:
            userMap[Number(draft.encoder_id)] || `User #${draft.encoder_id}`,
          current_tier: currentTier,
          max_level: maxLevel,
          approval_version: currentVersion,
        },
        payables: (payables as Record<string, unknown>[]).map((p) => ({
          id: p.id,
          coa_id: p.coa_id,
          coa_name: coaMap[Number(p.coa_id)] || `COA #${p.coa_id}`,
          amount: p.amount,
          remarks: p.remarks,
          date: p.date,
          reference_no: p.reference_no,
        })),
        approvers_by_level: approversByLevel,
        vote_history: voteHistory,
        my_level: myLevel,
        my_vote: myVote
          ? {
              status: String(myVote.status ?? ""),
              remarks: myVote.remarks ? String(myVote.remarks) : null,
              created_at: String(myVote.created_at ?? ""),
              version: Number(myVote.version),
            }
          : null,
        can_vote: myLevel === currentTier && !myVote,
      });
    }

    // ── logs ─────────────────────────────────────────────────────────────────
    if (resource === "logs") {
      // Query by DIVISION — not by user vote — so every level sees the same history
      // L1, L2, L3... all see all drafts in their authorized division(s)
      const divisionDraftQueries = myDivisionIds.map((divId) =>
        directusFetch(
          `/items/disbursement_draft?filter[division_id][_eq]=${divId}` +
          `&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,transaction_date,date_created,encoder_id,division_id` +
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

      // Resolve all relevant user names
      const uids = new Set<number>();
      for (const d of draftRows) {
        if (d.payee) uids.add(Number(d.payee));
        if (d.encoder_id) uids.add(Number(d.encoder_id));
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
            payee_name: userMap[Number(d.payee)] || `User #${d.payee}`,
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
    };
    const { draft_id, status, remarks } = body;

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
    const myLevel = approverRecords.reduce(
      (min, r) => Math.min(min, r.approver_heirarchy),
      99
    );

    // Fetch draft (incl. approval_version)
    const draftRes = await directusFetch(
      `/items/disbursement_draft?filter[id][_eq]=${draft_id}&fields=id,status,approval_version,payee,total_amount,remarks,transaction_date,division_id,encoder_id,transaction_type&limit=1`
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

    // Level check
    if (myLevel !== currentTier) {
      return json(
        {
          error: `You cannot vote now. Active tier: ${currentTier}, your tier: ${myLevel}.`,
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

    // Insert new vote with version
    await directusFetch(`/items/disbursement_draft_approvals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draft_id,
        approver_id: currentUserId,
        status,
        remarks: remarks?.trim() || null,
        version: currentVersion,
        created_at: nowTs,
      }),
    });

    // ── REJECTION: increment approval_version, reset draft to Submitted ──────
    // No vote data is touched — history is preserved!
    if (status === "REJECTED") {
      await directusFetch(`/items/disbursement_draft/${draft_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "Submitted",
          approval_version: currentVersion + 1,
        }),
      });

      return json({
        ok: true,
        result: "REJECTED",
        message: `Draft rejected (Round ${currentVersion}). All previous votes preserved. Draft resets to Level 1 for Round ${currentVersion + 1}.`,
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
    const totalInTier = tierApprovers.length;

    const tierApproverIds = tierApprovers.map((a) => Number(a.approver_id));

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

        await directusFetch(`/items/disbursement_draft/${draft_id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "Approved" }),
        });

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

        const liveDisbRes = await directusFetch(`/items/disbursement`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            doc_no: liveDocNo,
            transaction_type: Number(draft.transaction_type ?? 2),
            payee: draft.payee,
            remarks: finalRemarks,
            total_amount: draft.total_amount,
            paid_amount: 0,
            encoder_id: draft.encoder_id,
            approver_id: Number(highestApprover?.approver_id ?? currentUserId),
            posted_by: null,
            transaction_date: draft.transaction_date,
            division_id: draft.division_id,
            status: "Approved",
            isPosted: 0,
            date_approved: nowTs,
            date_created: nowTs,
            date_updated: nowTs,
          }),
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
