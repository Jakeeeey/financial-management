// src/app/api/fm/treasury/salesman-expense-approval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { startOfWeek, endOfWeek, format } from "date-fns";

export const runtime = "nodejs";

const DIRECTUS_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";
const COOKIE_NAME = "vos_access_token";

// ─── helpers ───────────────────────────────────────────────────────────────

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
  const computedHeaders = { ...authHeaders(), ...(init?.headers as Record<string, string> || {}) };

  if (!computedHeaders.Authorization && userToken) {
    computedHeaders.Authorization = `Bearer ${userToken}`;
  }

  const url = `${DIRECTUS_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: computedHeaders,
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
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
    const sub = payload["sub"] ?? payload["user_id"] ?? payload["id"];
    const n = Number(sub);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Manila "now" as a naive ISO string (no offset).
 *  Directus/MySQL on this stack stores Manila wall-clock time directly,
 *  so 1 PM Manila → "13:xx" in the column — consistent with system convention. */
function nowManila(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T");
}

/** Manila today as YYYY-MM-DD */
function todayManila(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Manila" });
}

async function getRbacFilters() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const currentUserId = token ? decodeJwtSub(token) : null;
  if (!currentUserId) return null;

  const [deptRes, supRes] = await Promise.all([
    directusFetch(`/items/department?filter[department_head_id][_eq]=${currentUserId}&fields=department_id&limit=-1`),
    directusFetch(`/items/supervisor_per_division?filter[supervisor_id][_eq]=${currentUserId}&filter[is_deleted][_eq]=0&fields=division_id&limit=-1`)
  ]);

  const myDepartments = ((deptRes.data as { data?: { department_id: number }[] })?.data ?? []).map((d) => Number(d.department_id));
  const myDivisions = ((supRes.data as { data?: { division_id: number }[] })?.data ?? []).map((s) => Number(s.division_id));

  return { currentUserId, myDepartments, myDivisions };
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const rbac = await getRbacFilters();
    if (!rbac) return json({ error: "Unauthorized" }, { status: 401 });
    const { currentUserId, myDepartments, myDivisions } = rbac;

    const isAuthorized = myDepartments.length > 0 || myDivisions.length > 0;

    const sp = req.nextUrl.searchParams;
    const resource = sp.get("resource") || "salesmen";

    if (!isAuthorized) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    // ── GET ?resource=expenses&salesman_id=X ───────────────────────────────
    if (resource === "expenses") {
      const salesmanId = sp.get("salesman_id");
      if (!salesmanId) return json({ error: "Missing salesman_id" }, { status: 400 });

      // 1. Get salesman record
      const sRes = await directusFetch(
        `/items/salesman?filter[id][_eq]=${salesmanId}&fields=id,salesman_name,salesman_code,employee_id,division_id&limit=1`
      );
      if (!sRes.ok) return json(sRes.data, { status: sRes.status });
      const salesman = ((sRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
      if (!salesman) return json({ error: "Salesman not found" }, { status: 404 });

      const employeeId = Number(salesman.employee_id);
      const divisionId_ref = Number(salesman.division_id || 0);

      // 2. Get user info for the salesman
      const uRes = await directusFetch(
        `/items/user?filter[user_id][_eq]=${employeeId}` +
        `&fields=user_id,user_fname,user_mname,user_lname,user_position,user_department&limit=1`
      );
      const userInfo = ((uRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
      const salesmanDeptId = userInfo?.user_department ? Number(userInfo.user_department) : 0;

      const isMyDept = myDepartments.includes(salesmanDeptId);

      const startDate = sp.get("start_date");
      const endDate = sp.get("end_date");

      let expFilter = `/items/expense_draft?filter[encoded_by][_eq]=${employeeId}` +
        `&filter[division_id][_eq]=${divisionId_ref}` +
        `&filter[status][_in]=Drafts,Rejected,With Concern`;

      if (startDate && endDate) {
        expFilter += `&filter[transaction_date][_between]=${startDate},${endDate}`;
      }

      // 3. Get expense_draft rows for this user matching division_id
      const eRes = await directusFetch(
        expFilter +
        `&fields=id,header_id,encoded_by,particulars,transaction_date,amount,payee,payee_id,attachment_url,status,drafted_at,rejected_at,approved_at,remarks,division_id,version,feedback` +
        `&limit=-1&sort=transaction_date`
      );
      if (!eRes.ok) return json(eRes.data, { status: eRes.status });
      const rawExpenses = (eRes.data as { data?: unknown[] })?.data ?? [];

      // Filter expenses according to RBAC logic
      const expenses = (rawExpenses as (Record<string, unknown> & { division_id?: number })[]).filter((exp) => {
        const isMyDiv = myDivisions.includes(Number(exp.division_id || 0));
        return isMyDept || isMyDiv;
      });

      // 4. Get expense ceiling for this user
      const cRes = await directusFetch(
        `/items/user_expense_ceiling?filter[user_id][_eq]=${employeeId}&limit=1`
      );
      const ceilingRow = ((cRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
      const expenseLimit = Number(ceilingRow?.expense_limit ?? 0);

      // 5. Fetch department and division names
      let divisionId: number | null = null;
      let departmentName = "";
      let divisionName = "";

      if (userInfo?.user_department) {
        const dRes = await directusFetch(
          `/items/department?filter[department_id][_eq]=${userInfo.user_department}&fields=department_id,department_name,parent_division&limit=1`
        );
        const dept = ((dRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
        if (dept) {
          departmentName = String(dept.department_name ?? "");
          if (dept.parent_division) {
            divisionId = Number(dept.parent_division);
            const divRes = await directusFetch(
              `/items/division?filter[division_id][_eq]=${divisionId}&fields=division_name&limit=1`
            );
            const div = ((divRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
            if (div) divisionName = String(div.division_name ?? "");
          }
        }
      }

      // 6. Get COA lookup for particulars
      const coa_ids: number[] = [...new Set(
        (expenses as Record<string, unknown>[]).map((e) => Number(e.particulars)).filter(Boolean)
      )];
      let coaMap: Record<number, string> = {};
      if (coa_ids.length > 0) {
        const coaRes = await directusFetch(
          `/items/chart_of_accounts?filter[coa_id][_in]=${coa_ids.join(",")}&fields=coa_id,account_title,gl_code&limit=-1`
        );
        const coaRows = (coaRes.data as { data?: unknown[] })?.data ?? [];
        coaMap = Object.fromEntries(
          (coaRows as Record<string, unknown>[]).map((c) => [Number(c.coa_id), String(c.account_title ?? "")])
        );
      }

      // 7. Enrich expenses with COA title
      const enriched = (expenses as Record<string, unknown>[]).map((e) => ({
        ...e,
        particulars_name: coaMap[Number(e.particulars)] ?? "",
      }));

      return json({
        salesman: {
          ...salesman,
          user: userInfo ?? null,
          division_id: divisionId,
          department_name: departmentName,
          division_name: divisionName,
        },
        expense_limit: expenseLimit,
        expenses: enriched,
      });
    }

    // ── GET ?resource=logs ────────────────────────────────────────────────
    if (resource === "logs") {
      const disbRes = await directusFetch(
        `/items/disbursement_draft?filter[transaction_type][_eq]=2&sort=-id&limit=200&fields=id,doc_no,status,transaction_date,payee,encoder_id,total_amount,remarks,approver_id,date_created,division_id`
      );
      if (!disbRes.ok) return json(disbRes.data, { status: disbRes.status });
      const logs = (disbRes.data as { data?: unknown[] })?.data ?? [] as Record<string, unknown>[];

      // Resolve user names (encoder, payee and approver)
      const uids = new Set<number>();
      for (const log of logs as Record<string, unknown>[]) {
        if (log.payee) uids.add(Number(log.payee)); // legacy
        if (log.encoder_id) uids.add(Number(log.encoder_id));
        if (log.approver_id) uids.add(Number(log.approver_id));
      }

      const userMap: Record<number, string> = {};
      const userDeptMap: Record<number, number> = {};
      if (uids.size > 0) {
        const uRes = await directusFetch(
          `/items/user?filter[user_id][_in]=${[...uids].join(",")}&fields=user_id,user_fname,user_lname,user_department&limit=-1`
        );
        const uRows = (uRes.data as { data?: Record<string, unknown>[] })?.data ?? [];
        for (const u of uRows) {
          userMap[Number(u.user_id)] = `${u.user_fname ?? ''} ${u.user_lname ?? ''}`.trim();
          userDeptMap[Number(u.user_id)] = Number(u.user_department) || 0;
        }
      }

      // Filter by RBAC
      const visibleLogs = (logs as (Record<string, unknown> & { approver_id?: number; payee?: number; encoder_id?: number; division_id?: number; id: number; doc_no: string; transaction_date: string; total_amount: number; remarks: string; status: string; date_created: string })[]).filter(log => {
        const isMyApproval = Number(log.approver_id) === currentUserId;
        const targetDept = userDeptMap[Number(log.encoder_id)] || userDeptMap[Number(log.payee)] || 0;
        const isMyDept = myDepartments.includes(targetDept);
        const isMyDiv = myDivisions.includes(Number(log.division_id || 0));
        return isMyApproval || isMyDept || isMyDiv;
      }).slice(0, 50);

      // Fetch Treasury Votes (Approvals History) for these logs
      const logIds = visibleLogs.map((l) => Number(l.id));
      let allVotes: Record<string, unknown>[] = [];
      let allDraftLogs: Record<string, unknown>[] = [];
      let allExpenseLogs: Record<string, unknown>[] = [];

      if (logIds.length > 0) {
        const [vRes, dlRes] = await Promise.all([
          directusFetch(`/items/disbursement_draft_approvals?filter[draft_id][_in]=${logIds.join(",")}&filter[status][_neq]=DRAFT&fields=draft_id,approver_id,status,remarks,version,created_at&sort=version,created_at&limit=-1`),
          directusFetch(`/items/disbursement_draft_logs?filter[disbursement_id][_in]=${logIds.join(",")}&fields=id,disbursement_id,updated_by,edit_reason,payload_snapshot,log_date&sort=-log_date&limit=-1`),
        ]);

        // Wait! Directus doesn't support subqueries in filter JSON usually.
        // Let's do it in two steps for expense_logs if needed, or just fetch ALL for the logIds via payables.

        // Actually, let's fetch expense_ids from payables first.
        const pResForIds = await directusFetch(`/items/disbursement_payables_draft?filter[disbursement_id][_in]=${logIds.join(",")}&fields=expense_id&limit=-1`);
        const pRowsForIds = (pResForIds.data as { data?: Record<string, unknown>[] })?.data ?? [];
        const expenseIdsForAudit = [...new Set(pRowsForIds.map(pr => {
          const raw = pr.expense_id;
          if (typeof raw === "object" && raw !== null) return Number((raw as { id: number }).id);
          return Number(raw);
        }).filter(id => !isNaN(id) && id > 0))];

        if (expenseIdsForAudit.length > 0) {
          const finalElRes = await directusFetch(`/items/expense_draft_logs?filter[expense_id][_in]=${expenseIdsForAudit.join(",")}&fields=log_id,expense_id,action,changed_by,changed_at,amount,remarks,particulars,status&limit=-1`);
          allExpenseLogs = (finalElRes.data as { data?: Record<string, unknown>[] })?.data ?? [];
        }

        allVotes = (vRes.data as { data?: Record<string, unknown>[] })?.data ?? [];
        allDraftLogs = (dlRes.data as { data?: Record<string, unknown>[] })?.data ?? [];

        // Resolve user names for all actors
        const voteUids = [...new Set([
          ...allVotes.map(v => Number(v.approver_id)),
          ...allDraftLogs.map(l => Number(l.updated_by)),
          ...allExpenseLogs.map(l => Number(l.changed_by))
        ].filter(Boolean))];

        const missingUids = voteUids.filter(uid => !userMap[uid]);
        if (missingUids.length > 0) {
          const uRes = await directusFetch(`/items/user?filter[user_id][_in]=${missingUids.join(",")}&fields=user_id,user_fname,user_lname&limit=-1`);
          for (const u of (uRes.data as { data?: Record<string, unknown>[] })?.data ?? []) {
            userMap[Number(u.user_id)] = `${u.user_fname ?? ''} ${u.user_lname ?? ''}`.trim();
          }
        }

        // Resolve COA names for expense logs
        const coaIdsForLogs = [...new Set(allExpenseLogs.map(l => Number(l.particulars)).filter(Boolean))];
        const coaMapForLogs: Record<number, string> = {};
        if (coaIdsForLogs.length > 0) {
          const cRes = await directusFetch(`/items/chart_of_accounts?filter[coa_id][_in]=${coaIdsForLogs.join(",")}&fields=coa_id,account_title&limit=-1`);
          for (const c of (cRes.data as { data?: Record<string, unknown>[] })?.data ?? []) {
            coaMapForLogs[Number(c.coa_id)] = String(c.account_title ?? "");
          }
        }

        const formattedLogs = visibleLogs.map((log) => {
          const logVotes = allVotes
            .filter(v => Number(v.draft_id) === Number(log.id))
            .map(v => ({
              approver_name: userMap[Number(v.approver_id)] || `User #${v.approver_id}`,
              status: String(v.status),
              remarks: v.remarks ? String(v.remarks) : null,
              version: Number(v.version),
              created_at: String(v.created_at ?? ""),
            }));

          const draftLogs = allDraftLogs
            .filter(l => Number(l.disbursement_id) === Number(log.id))
            .map(l => {
              let snapshot = { old_total: 0, new_total: 0 };
              try { snapshot = JSON.parse(String(l.payload_snapshot || "{}")); } catch { }
              return {
                id: Number(l.id),
                editor_name: userMap[Number(l.updated_by)] || `User #${l.updated_by}`,
                edit_reason: String(l.edit_reason || ""),
                old_total: Number(snapshot.old_total || 0),
                new_total: Number(snapshot.new_total || 0),
                created_at: String(l.log_date || ""),
              };
            });

          // Match expense logs using the mapping
          const currentExpenseIds = pRowsForIds
            .filter(pr => {
              const draftId = typeof pr.disbursement_id === "object" && pr.disbursement_id !== null ? (pr.disbursement_id as { id: number }).id : pr.disbursement_id;
              return Number(draftId) === Number(log.id);
            })
            .map(pr => {
              const raw = pr.expense_id;
              if (typeof raw === "object" && raw !== null) return Number((raw as { id: number }).id);
              return Number(raw);
            });

          const expenseLogs = allExpenseLogs
            .filter(l => currentExpenseIds.includes(Number(l.expense_id)))
            .map(l => ({
              id: Number(l.log_id),
              expense_id: Number(l.expense_id),
              action: String(l.action || ""),
              editor_name: userMap[Number(l.changed_by)] || `User #${l.changed_by}`,
              changed_at: String(l.changed_at || ""),
              amount: Number(l.amount || 0),
              remarks: l.remarks ? String(l.remarks) : null,
              particulars: coaMapForLogs[Number(l.particulars)] || String(l.particulars || ""),
              status: String(l.status || ""),
            }));

          return {
            id: log.id,
            doc_no: log.doc_no,
            transaction_date: log.transaction_date,
            salesman_name: userMap[Number(log.encoder_id)] || userMap[Number(log.payee)] || `User #${log.encoder_id || log.payee}`,
            total_amount: log.total_amount,
            remarks: log.remarks,
            approver_name: userMap[Number(log.approver_id)] || `User #${log.approver_id}`,
            status: log.status,
            date_created: log.date_created,
            votes: logVotes,
            logs: draftLogs,
            expense_logs: expenseLogs,
          };
        });

        return json({ data: formattedLogs });
      }
      return json({ data: [] });
    }

    // ── GET ?resource=log-details ─────────────────────────────────────────
    if (resource === "log-details") {
      const disbId = sp.get("disbursement_id");
      if (!disbId) return json({ error: "Disbursement ID required" }, { status: 400 });

      const pRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${disbId}&fields=id,coa_id,amount,remarks,date&limit=-1`
      );
      if (!pRes.ok) return json(pRes.data, { status: pRes.status });
      const payables = (pRes.data as { data?: unknown[] })?.data ?? [] as Record<string, unknown>[];

      // Resolve COA names
      const coaIds = [...new Set((payables as Record<string, unknown>[]).map((p) => Number(p.coa_id)))];
      let coaMap: Record<number, string> = {};
      if (coaIds.length > 0) {
        const cRes = await directusFetch(
          `/items/chart_of_accounts?filter[coa_id][_in]=${coaIds.join(",")}&fields=coa_id,account_title&limit=-1`
        );
        const cRows = (cRes.data as { data?: unknown[] })?.data ?? [];
        coaMap = Object.fromEntries(
          (cRows as Record<string, unknown>[]).map((c) => [Number(c.coa_id), String(c.account_title ?? "")])
        );
      }

      const formattedPayables = (payables as Record<string, unknown>[]).map((p) => ({
        id: p.id,
        coa_name: coaMap[Number(p.coa_id)] || `COA #${p.coa_id}`,
        amount: p.amount,
        remarks: p.remarks,
        date: p.date,
      }));

      return json({ data: formattedPayables });
    }

    // ── GET ?resource=available-weeks ─────────────────────────────────────
    if (resource === "available-weeks") {
      const eRes = await directusFetch(
        `/items/expense_draft?filter[status][_in]=Drafts,Rejected,With Concern&fields=transaction_date&limit=-1`
      );
      if (!eRes.ok) return json(eRes.data, { status: eRes.status });
      const raw = ((eRes.data as { data?: unknown[] })?.data ?? []) as Record<string, unknown>[];

      const weekMap: Record<string, { week_start: string; week_end: string; week_label: string }> = {};
      for (const exp of raw) {
        if (!exp.transaction_date) continue;
        const d = new Date(String(exp.transaction_date) + "T00:00:00");
        const wStart = startOfWeek(d, { weekStartsOn: 1 });
        const wEnd = endOfWeek(d, { weekStartsOn: 1 });
        const key = format(wStart, "yyyy-MM-dd");
        if (!weekMap[key]) {
          weekMap[key] = {
            week_start: format(wStart, "yyyy-MM-dd"),
            week_end: format(wEnd, "yyyy-MM-dd"),
            week_label: `${format(wStart, "MMM d")} - ${format(wEnd, "d, yyyy")}`
          };
        }
      }
      return json({ data: Object.values(weekMap).sort((a, b) => b.week_start.localeCompare(a.week_start)) });
    }

    // ── GET ?resource=salesmen (default) ──────────────────────────────────
    // 1. Fetch all active salesmen
    const sRes = await directusFetch(
      `/items/salesman?fields=id,salesman_name,salesman_code,employee_id,division_id&filter[isActive][_eq]=1&limit=-1&sort=salesman_name`
    );
    if (!sRes.ok) return json(sRes.data, { status: sRes.status });
    const salesmen = ((sRes.data as { data?: unknown[] })?.data ?? []) as Record<string, unknown>[];

    if (salesmen.length === 0) return json({ data: [] });

    // 1.5. Fetch user departments for salesmen to apply Logic 1
    const uids = [...new Set(salesmen.map((s) => Number(s.employee_id)).filter(Boolean))];
    const userDeptMap: Record<number, number> = {};
    if (uids.length > 0) {
      const uRes = await directusFetch(
        `/items/user?filter[user_id][_in]=${uids.join(",")}&fields=user_id,user_department&limit=-1`
      );
      const uRows = (uRes.data as { data?: unknown[] })?.data ?? [];
      for (const u of uRows as Record<string, unknown>[]) {
        if (u.user_department) userDeptMap[Number(u.user_id)] = Number(u.user_department);
      }
    }

    const startDate = sp.get("start_date");
    const endDate = sp.get("end_date");

    let expFilterBase = `/items/expense_draft?filter[status][_in]=Drafts,Rejected,With Concern&filter[approved_at][_null]=true`;
    if (startDate && endDate) {
      expFilterBase += `&filter[transaction_date][_between]=[${startDate},${endDate}]`;
    }

    // 2. Get all expense_draft (Drafts + Rejected) and filter by RBAC
    const allExpRes = await directusFetch(
      `${expFilterBase}&fields=id,encoded_by,division_id,status,transaction_date,approved_at&limit=-1`
    );
    const rawExpenses = ((allExpRes.data as { data?: unknown[] })?.data ?? []) as Record<string, unknown>[];

    // RBAC Filter:
    const allExpenses = rawExpenses.filter((exp: Record<string, unknown>) => {
      const salesmanDeptId = userDeptMap[Number(exp.encoded_by)] || 0;
      const isMyDept = myDepartments.includes(salesmanDeptId);
      const isMyDiv = myDivisions.includes(Number(exp.division_id || 0));
      return isMyDept || isMyDiv;
    });

    // Build map: "encoded_by_division_id_week" → { draft: count, rejected: count, week_start, week_end, week_label }
    const countMap: Record<string, { draft: number; rejected: number; week_start: string; week_end: string; week_label: string }> = {};
    for (const exp of allExpenses as Record<string, unknown>[]) {
      const d = new Date(String(exp.transaction_date) + "T00:00:00");
      const wStart = startOfWeek(d, { weekStartsOn: 1 });
      const wEnd = endOfWeek(d, { weekStartsOn: 1 });
      const weekKey = format(wStart, "yyyy-MM-dd");

      const key = `${exp.encoded_by}_${exp.division_id}_${weekKey}`;
      if (!countMap[key]) {
        countMap[key] = {
          draft: 0,
          rejected: 0,
          week_start: format(wStart, "yyyy-MM-dd"),
          week_end: format(wEnd, "yyyy-MM-dd"),
          week_label: `${format(wStart, "MMM d")} - ${format(wEnd, "d, yyyy")}`
        };
      }
      if (exp.status === "Drafts" || exp.status === "With Concern") {
        if (!exp.approved_at) countMap[key].draft++;
      }
      if (exp.status === "Rejected") countMap[key].rejected++;
    }

    // 3. Resolve division names
    const divisionIds = [...new Set(
      (salesmen as Record<string, unknown>[]).map((s) => Number(s.division_id)).filter(Boolean)
    )];
    const divisionNameMap: Record<number, string> = {};
    if (divisionIds.length > 0) {
      const divRes = await directusFetch(
        `/items/division?filter[division_id][_in]=${divisionIds.join(",")}&fields=division_id,division_name&limit=-1`
      );
      const divRows = (divRes.data as { data?: Record<string, unknown>[] })?.data ?? [];
      for (const d of divRows) {
        divisionNameMap[Number(d.division_id)] = String(d.division_name ?? "");
      }
    }

    // 4. Map salesmen to counts (single row per salesman for the selected period)
    const result = (salesmen as Record<string, unknown>[])
      .map((s) => {
        const employeeId = s.employee_id;
        const divisionId = s.division_id;

        // Find if this salesman has any expenses in the countMap (which is already filtered by week)
        const prefix = `${employeeId}_${divisionId}_`;
        const relevantKeys = Object.keys(countMap).filter(k => k.startsWith(prefix));

        if (relevantKeys.length === 0) return null;

        // Aggregate counts if there are multiple weeks in the range (though usually it will be one week)
        let totalDraft = 0;
        let totalRejected = 0;
        let weekLabel = "";
        let weekStart = "";
        let weekEnd = "";

        relevantKeys.forEach(k => {
          // If we have a startDate/endDate filter, only aggregate the specific week requested
          // or if no filter, aggregate everything (the current behavior).
          // But usually we filter by week from the frontend.
          if (startDate && countMap[k].week_start !== startDate) return;

          totalDraft += countMap[k].draft;
          totalRejected += countMap[k].rejected;
          if (!weekLabel) {
            weekLabel = countMap[k].week_label;
            weekStart = countMap[k].week_start;
            weekEnd = countMap[k].week_end;
          }
        });

        const divId = divisionId ? Number(divisionId) : null;
        return {
          id: s.id,
          salesman_name: s.salesman_name,
          salesman_code: s.salesman_code,
          employee_id: s.employee_id,
          division_id: divId,
          division_name: divId ? (divisionNameMap[divId] ?? null) : null,
          draft_count: totalDraft,
          rejected_count: totalRejected,
          week_start: weekStart,
          week_end: weekEnd,
          week_label: weekLabel,
        };
      })
      .filter(Boolean);

    return json({ data: result });

  } catch (e: unknown) {
    return json({ error: "Server error", message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      item_decisions: Record<number, { status: "Approved" | "Rejected" | "With Concern"; remarks: string }>;
      remarks: string;
      salesman_id: number;
      all_ids?: number[];
      salesman_user_id?: number;
      edited_amounts?: { id: number; amount: number }[] | Record<number, number>;
    };

    const { item_decisions, remarks, salesman_id } = body;
    let { all_ids, salesman_user_id, edited_amounts } = body;

    if (!item_decisions) return json({ error: "No decisions provided" }, { status: 400 });

    // Auto-resolve all_ids if missing
    if (!all_ids) {
      all_ids = Object.keys(item_decisions).map(id => Number(id));
    }

    const selected_ids = Object.entries(item_decisions)
      .filter(([_, dec]) => dec.status === "Approved")
      .map(([id, _]) => Number(id));

    // Identify Cost Center and Salesman User ID
    let salesmanDivisionId: number | null = null;
    let salesmanDepartmentId: number | null = null;

    const sRes = await directusFetch(`/items/salesman?filter[id][_eq]=${salesman_id}&fields=id,division_id,employee_id&limit=1`);
    const sRec = ((sRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
    if (sRec?.division_id) salesmanDivisionId = Number(sRec.division_id);
    
    // Resolve salesman_user_id if missing
    if (!salesman_user_id && sRec?.employee_id) {
      salesman_user_id = Number(sRec.employee_id);
    }
    if (!salesman_user_id) return json({ error: "Could not resolve salesman user ID" }, { status: 400 });

    const uRes = await directusFetch(`/items/user?filter[user_id][_eq]=${salesman_user_id}&fields=user_id,user_department&limit=1`);
    const uRec = ((uRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
    if (uRec?.user_department) salesmanDepartmentId = Number(uRec.user_department);

    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const approverId = token ? decodeJwtSub(token) : null;
    if (!approverId) return json({ error: "Unauthorized" }, { status: 401 });

    const nowTs = nowManila();

    // 1. Fetch current submittal items + ALL previously approved items for this salesman
    // This ensures incremental approvals don't wipe out previous work in the same disbursement.
    const eRes = await directusFetch(
      `/items/expense_draft?filter[encoded_by][_eq]=${salesman_user_id}&filter[status][_in]=Approved,Drafts,Rejected,With Concern&fields=id,header_id,encoded_by,particulars,amount,transaction_date,attachment_url,remarks,division_id,payee,payee_id,status,version&limit=-1`
    );
    const allRelevantRows = (((eRes.data as { data?: unknown[] })?.data) ?? []) as Record<string, any>[];
    
    // Rows specifically in the current submittal
    const allDetailRows = allRelevantRows.filter(r => all_ids.includes(Number(r.id)));

    // 2. Process Amount Changes & Audit Logs (vos_database.expense_draft_logs)
    if (edited_amounts) {
      const normalizedAmounts: Record<number, number> = Array.isArray(edited_amounts)
        ? Object.fromEntries(edited_amounts.map(item => [item.id, item.amount]))
        : edited_amounts;

      for (const [idStr, newAmount] of Object.entries(normalizedAmounts)) {
        const id = Number(idStr);
        const original = allDetailRows.find(e => Number(e.id) === id);
        if (original) {
          const finalStatus = item_decisions[id]?.status || original.status;
          const newVersion = Number(original.version ?? 1) + 1;

          // Insert into expense_draft_logs
          await directusFetch(`/items/expense_draft_logs`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              expense_id: id,
              action: "UPDATE",
              changed_by: approverId,
              changed_at: nowTs,
              particulars: original.particulars,
              division_id: original.division_id,
              transaction_date: original.transaction_date,
              amount: newAmount,
              payee: original.payee,
              status: finalStatus,
              remarks: `Amount adjusted from ${original.amount} to ${newAmount} by Treasury.`,
              version: newVersion,
            }),
          });

          // Update expense_draft
          const decisionForThis = item_decisions[id];
          const updateObj: Record<string, any> = { 
            amount: newAmount, 
            version: newVersion 
          };
          
          if (decisionForThis) {
            updateObj.status = decisionForThis.status;
            updateObj.feedback = decisionForThis.status !== "Approved" ? decisionForThis.remarks : null;
            if (decisionForThis.status === "Approved") updateObj.approved_at = nowTs;
            if (decisionForThis.status === "Rejected") updateObj.rejected_at = nowTs;
          }

          await directusFetch(`/items/expense_draft/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(updateObj),
          });

          original.amount = newAmount;
          original.version = newVersion;
        }
      }
    }

    // 3. Update Statuses & Feedback for non-edited items
    const editedIds = edited_amounts 
      ? (Array.isArray(edited_amounts) ? edited_amounts.map(a => a.id) : Object.keys(edited_amounts).map(Number))
      : [];

    for (const id of all_ids) {
      if (editedIds.includes(id)) continue; // Already updated in Step 2

      const decision = item_decisions[id];
      const original = allDetailRows.find(e => Number(e.id) === id);
      if (!decision || !original) continue;

      const updateData: Record<string, any> = {
        status: decision.status,
        feedback: decision.status !== "Approved" ? decision.remarks : null,
      };

      if (decision.status === "Approved") updateData.approved_at = nowTs;
      if (decision.status === "Rejected") updateData.rejected_at = nowTs;

      await directusFetch(`/items/expense_draft/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updateData),
      });
    }

    // 4. Consolidation: Current approvals + Previous approvals
    // items in item_decisions take precedence (current session)
    // items NOT in item_decisions but already 'Approved' in DB are also included (additive)
    const selectedExpenses = allRelevantRows.filter((row) => {
      const decision = item_decisions[row.id];
      if (decision) return decision.status === "Approved";
      return row.status === "Approved"; 
    });
    if (selectedExpenses.length === 0) {
      return json({ ok: true, disbursement_id: null, message: "All items processed (No Approvals)" });
    }

    // 4. Disbursement Recycling Logic (Zero-Gap)
    let disbursementId: number | null = null;
    let docNo: string | null = null;
    let approvalVersion = 1;

    const existingPayRes = await directusFetch(
      `/items/disbursement_payables_draft?filter[expense_id][_in]=${selected_ids.join(",")}&fields=disbursement_id&limit=1`
    );
    const existingPayRows = (existingPayRes.data as { data?: Record<string, any>[] })?.data ?? [];
    if (existingPayRows.length > 0) {
      const dId = typeof existingPayRows[0].disbursement_id === "object" ? existingPayRows[0].disbursement_id.id : existingPayRows[0].disbursement_id;
      const dRes = await directusFetch(`/items/disbursement_draft/${dId}?fields=id,doc_no,approval_version,total_amount`);
      const dRow = (dRes.data as { data?: Record<string, any> })?.data;
      if (dRow) {
        disbursementId = Number(dRow.id);
        docNo = String(dRow.doc_no);
        approvalVersion = Number(dRow.approval_version || 1) + 1;
      }
    }

    const totalAmount = selectedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const supportingDocs = selectedExpenses.filter(e => e.attachment_url).map(e => e.attachment_url).join(",");

    if (disbursementId) {
      // 5a. Update Existing Disbursement
      await directusFetch(`/items/disbursement_draft/${disbursementId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          total_amount: totalAmount,
          remarks: remarks || null,
          supporting_documents_url: supportingDocs || null,
          status: "Submitted",
          approval_version: approvalVersion,
          date_updated: nowTs,
        }),
      });

      // Cleanup old payables for full refresh
      const oldPayRes = await directusFetch(`/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${disbursementId}&fields=id`);
      const oldPayIds = ((oldPayRes.data as { data?: { id: number }[] })?.data ?? []).map(p => p.id);
      if (oldPayIds.length > 0) {
        await directusFetch(`/items/disbursement_payables_draft`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(oldPayIds),
        });
      }
    } else {
      // 5b. Create New Disbursement (NT-XXXX)
      const latestRes = await directusFetch(`/items/disbursement_draft?filter[doc_no][_starts_with]=NT-&sort=-id&limit=1&fields=doc_no`);
      const latestDoc = ((latestRes.data as { data?: { doc_no: string }[] })?.data ?? [])[0]?.doc_no;
      let nextNum = 1000;
      if (latestDoc) {
        const match = latestDoc.match(/NT-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      docNo = `NT-${nextNum}`;

      const newDisbRes = await directusFetch(`/items/disbursement_draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doc_no: docNo,
          transaction_type: 2,
          payee: selectedExpenses[0]?.payee_id || salesman_user_id,
          encoder_id: salesman_user_id,
          approver_id: approverId,
          total_amount: totalAmount,
          transaction_date: selectedExpenses[0]?.transaction_date || todayManila(),
          division_id: salesmanDivisionId,
          department_id: salesmanDepartmentId,
          remarks: remarks || null,
          supporting_documents_url: supportingDocs || null,
          status: "Submitted",
          isPosted: 0,
          date_created: nowTs,
          date_updated: nowTs,
          date_approved: nowTs,
        }),
      });
      disbursementId = Number((newDisbRes.data as any)?.data?.id);
    }

    // 6. Create Payables (vos_database.disbursement_payables_draft)
    const payables = selectedExpenses.map(e => ({
      disbursement_id: disbursementId,
      expense_id: Number(e.id),
      division_id: salesmanDivisionId,
      reference_no: docNo,
      date: e.transaction_date,
      coa_id: Number(e.particulars),
      amount: Number(e.amount),
      remarks: e.remarks || null,
      version: e.version || 1,
      date_created: nowTs,
    }));

    await directusFetch(`/items/disbursement_payables_draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payables),
    });

    return json({ ok: true, disbursement_id: disbursementId, doc_no: docNo });

  } catch (e: any) {
    return json({ error: "Server error", message: e.message }, { status: 500 });
  }
}

