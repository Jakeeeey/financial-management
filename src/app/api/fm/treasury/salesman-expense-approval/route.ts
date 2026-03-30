// src/app/api/fm/treasury/salesman-expense-approval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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

      // 3. Get expense_draft rows for this user (Drafts + Rejected) matching division_id
      const eRes = await directusFetch(
        `/items/expense_draft?filter[encoded_by][_eq]=${employeeId}` +
        `&filter[division_id][_eq]=${divisionId_ref}` +
        `&filter[status][_in]=Drafts,Rejected` +
        `&fields=id,encoded_by,particulars,transaction_date,amount,payee,attachment_url,status,drafted_at,rejected_at,approved_at,remarks,division_id` +
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
      const visibleLogs = (logs as (Record<string, unknown> & { approver_id?: number; payee?: number; encoder_id?: number; division_id?: number })[]).filter(log => {
        const isMyApproval = Number(log.approver_id) === currentUserId;
        const targetDept = userDeptMap[Number(log.encoder_id)] || userDeptMap[Number(log.payee)] || 0;
        const isMyDept = myDepartments.includes(targetDept);
        const isMyDiv = myDivisions.includes(Number(log.division_id || 0));
        return isMyApproval || isMyDept || isMyDiv;
      }).slice(0, 50);

      const formattedLogs = visibleLogs.map((log) => ({
        id: log.id,
        doc_no: log.doc_no,
        transaction_date: log.transaction_date,
        salesman_name: userMap[Number(log.encoder_id)] || userMap[Number(log.payee)] || `User #${log.encoder_id || log.payee}`,
        total_amount: log.total_amount,
        remarks: log.remarks,
        approver_name: userMap[Number(log.approver_id)] || `User #${log.approver_id}`,
        status: log.status,
        date_created: log.date_created,
      }));

      return json({ data: formattedLogs });
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

    // 2. Get all expense_draft (Drafts + Rejected) and filter by RBAC
    const allExpRes = await directusFetch(
      `/items/expense_draft?filter[status][_in]=Drafts,Rejected&fields=id,encoded_by,division_id,status&limit=-1`
    );
    const rawExpenses = ((allExpRes.data as { data?: unknown[] })?.data ?? []) as Record<string, unknown>[];

    // RBAC Filter:
    const allExpenses = rawExpenses.filter((exp: Record<string, unknown>) => {
      const salesmanDeptId = userDeptMap[Number(exp.encoded_by)] || 0;
      const isMyDept = myDepartments.includes(salesmanDeptId);
      const isMyDiv = myDivisions.includes(Number(exp.division_id || 0));
      return isMyDept || isMyDiv;
    });

    // Build map: "encoded_by_division_id" → { draft: count, rejected: count }
    const countMap: Record<string, { draft: number; rejected: number }> = {};
    for (const exp of allExpenses as Record<string, unknown>[]) {
      const key = `${exp.encoded_by}_${exp.division_id}`;
      if (!countMap[key]) countMap[key] = { draft: 0, rejected: 0 };
      if (exp.status === "Drafts") countMap[key].draft++;
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

    // 4. Map salesmen to counts using composite key
    const result = (salesmen as Record<string, unknown>[])
      .map((s) => {
        const key = `${s.employee_id}_${s.division_id}`;
        const counts = countMap[key] || { draft: 0, rejected: 0 };
        if (counts.draft === 0 && counts.rejected === 0) return null;
        const divId = s.division_id ? Number(s.division_id) : null;
        return {
          id: s.id,
          salesman_name: s.salesman_name,
          salesman_code: s.salesman_code,
          employee_id: s.employee_id,
          division_id: divId,
          division_name: divId ? (divisionNameMap[divId] ?? null) : null,
          draft_count: counts.draft,
          rejected_count: counts.rejected,
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
      selected_ids: number[];   // expense_draft IDs to approve
      all_ids: number[];        // all expense_draft IDs shown in modal
      remarks: string;
      salesman_user_id: number; // user_id (employee_id)
      salesman_id: number;      // salesman.id
      device_time?: string;     // local device time
      edited_amounts?: Record<number, number>;
    };

    const { selected_ids, all_ids, remarks, salesman_user_id, salesman_id, device_time, edited_amounts } = body;

    if (!all_ids?.length) return json({ error: "No expense IDs provided" }, { status: 400 });

    // ── IDENTIFY COST CENTER (Salesman Division/Dept) ──────────────────
    let salesmanDivisionId: number | null = null;
    let salesmanDepartmentId: number | null = null;

    // 1. Get division from salesman table
    const sRes = await directusFetch(
      `/items/salesman?filter[id][_eq]=${salesman_id}&fields=id,division_id&limit=1`
    );
    const sRec = ((sRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
    if (sRec?.division_id) salesmanDivisionId = Number(sRec.division_id);

    // 2. Get department from user table
    const uRes = await directusFetch(
      `/items/user?filter[user_id][_eq]=${salesman_user_id}&fields=user_id,user_department&limit=1`
    );
    const uRec = ((uRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
    if (uRec?.user_department) salesmanDepartmentId = Number(uRec.user_department);

    // Get approver from JWT cookie
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const approverId = token ? decodeJwtSub(token) : null;
    if (!approverId) return json({ error: "Unauthorized: no approver identified" }, { status: 401 });

    const [deptRes, supRes] = await Promise.all([
      directusFetch(`/items/department?filter[department_head_id][_eq]=${approverId}&fields=department_id&limit=-1`),
      directusFetch(`/items/supervisor_per_division?filter[supervisor_id][_eq]=${approverId}&filter[is_deleted][_eq]=0&fields=division_id&limit=-1`)
    ]);

    const myDepartments = ((deptRes.data as { data?: { department_id: number }[] })?.data ?? []).map((d) => Number(d.department_id));
    const myDivisions = ((supRes.data as { data?: { division_id: number }[] })?.data ?? []).map((s) => Number(s.division_id));

    if (myDepartments.length === 0 && myDivisions.length === 0) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const nowTs = device_time || nowManila();
    const rejectedIds = all_ids.filter((id) => !selected_ids.includes(id));

    // 1. Fetch ALL expense details (for logging and building)
    const eRes = await directusFetch(
      `/items/expense_draft?filter[id][_in]=${all_ids.join(",")}&fields=id,encoded_by,particulars,amount,transaction_date,attachment_url,remarks,division_id,payee,status,version&limit=-1`
    );
    const rawDetailRows = (((eRes.data as { data?: unknown[] })?.data) ?? []) as Record<string, unknown>[];

    const allDetailRows = rawDetailRows.filter((exp: Record<string, unknown>) => {
      const isMyDept = myDepartments.includes(salesmanDepartmentId || 0);
      const isMyDiv = myDivisions.includes(Number(exp.division_id || 0));
      return isMyDept || isMyDiv;
    });

    if (allDetailRows.length !== rawDetailRows.length) {
      return json({ error: "Forbidden: Not authorized for some selected expenses" }, { status: 403 });
    }

    // 2. Process Amount Changes & Audit Logs for ANY item in the batch
    if (edited_amounts && Object.keys(edited_amounts).length > 0) {
      for (const [idStr, newAmount] of Object.entries(edited_amounts)) {
        const id = Number(idStr);
        const original = allDetailRows.find(e => Number(e.id) === id);
        if (original) {
          // Determine status for the log
          const finalStatus = selected_ids.includes(id) ? "Approved" : "Rejected";

          // Determine new version
          const newVersion = Number(original.version ?? 1) + 1;

          // Log the change
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
              remarks: `Amount adjusted from ${original.amount} to ${newAmount} during treasury approval process (${finalStatus}). Version advanced to ${newVersion}.`,
              version: newVersion,
            }),
          });

          // Update the expense_draft record
          await directusFetch(`/items/expense_draft/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              amount: newAmount,
              version: newVersion
            }),
          });

          // Update local row for subsequent logic
          original.amount = newAmount;
        }
      }
    }

    // Filter out only the selected rows for disbursement building
    const selectedExpenses = allDetailRows.filter((row) => selected_ids.includes(Number(row.id)));

    // 3. Update approved status
    if (selected_ids.length > 0) {
      await directusFetch(`/items/expense_draft`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keys: selected_ids,
          data: { status: "Approved", approved_at: nowTs },
        }),
      });
    }

    // 4. Update rejected status
    if (rejectedIds.length > 0) {
      await directusFetch(`/items/expense_draft`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keys: rejectedIds,
          data: { status: "Rejected", rejected_at: nowTs },
        }),
      });
    }

    if (selected_ids.length === 0) {
      return json({ ok: true, disbursement_id: null, message: "All expenses rejected" });
    }

    // 4. Generate doc_no: fetch latest disbursement_draft to get next number
    const latestRes = await directusFetch(
      `/items/disbursement_draft?filter[doc_no][_starts_with]=NT-&sort=-id&fields=id,doc_no&limit=1`
    );
    const latestRow = ((latestRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
    let nextNum = 1000;
    if (latestRow?.doc_no) {
      const match = String(latestRow.doc_no).match(/NT-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const docNo = `NT-${nextNum}`;

    // 5. Build disbursement totals
    const totalAmount = selectedExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    const firstExpense = selectedExpenses[0];
    const transactionDate = firstExpense?.transaction_date ? String(firstExpense.transaction_date) : todayManila();
    const supportingDocs = selectedExpenses
      .filter((e) => e.attachment_url)
      .map((e) => String(e.attachment_url))
      .join(",");

    // 6. Create disbursement_draft
    const disbRes = await directusFetch(`/items/disbursement_draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc_no: docNo,
        transaction_type: 2,
        payee: null,
        encoder_id: salesman_user_id,
        approver_id: approverId,
        total_amount: totalAmount,
        paid_amount: 0,
        transaction_date: transactionDate,
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

    if (!disbRes.ok) return json({ error: "Failed to create disbursement", detail: disbRes.data }, { status: 500 });

    const disbursementId = Number(
      ((disbRes.data as { data?: Record<string, unknown> })?.data)?.id ?? 0
    );
    if (!disbursementId) return json({ error: "Disbursement created but no ID returned" }, { status: 500 });

    // 7. Create disbursement_payables_draft — one per approved expense
    const payablePayloads = selectedExpenses.map((e) => ({
      disbursement_id: disbursementId,
      division_id: salesmanDivisionId,
      reference_no: docNo,
      date: e.transaction_date ? String(e.transaction_date) : transactionDate,
      coa_id: e.particulars,
      amount: Number(e.amount ?? 0),
      remarks: e.remarks ?? null,
      date_created: nowTs,
    }));

    await directusFetch(`/items/disbursement_payables_draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payablePayloads),
    });

    return json({ ok: true, disbursement_id: disbursementId, doc_no: docNo });
  } catch (e: unknown) {
    return json({ error: "Server error", message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

