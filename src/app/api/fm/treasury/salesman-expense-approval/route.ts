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

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const resource = sp.get("resource") || "salesmen";

    // ── GET ?resource=expenses&salesman_id=X ───────────────────────────────
    if (resource === "expenses") {
      const salesmanId = sp.get("salesman_id");
      if (!salesmanId) return json({ error: "Missing salesman_id" }, { status: 400 });

      // 1. Get salesman record
      const sRes = await directusFetch(
        `/items/salesman?filter[id][_eq]=${salesmanId}&fields=id,salesman_name,salesman_code,employee_id&limit=1`
      );
      if (!sRes.ok) return json(sRes.data, { status: sRes.status });
      const salesman = ((sRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
      if (!salesman) return json({ error: "Salesman not found" }, { status: 404 });

      const employeeId = Number(salesman.employee_id);

      // 2. Get expense_draft rows for this user (Drafts + Rejected)
      const eRes = await directusFetch(
        `/items/expense_draft?filter[encoded_by][_eq]=${employeeId}` +
        `&filter[status][_in]=Drafts,Rejected` +
        `&fields=id,encoded_by,particulars,transaction_date,amount,payee,attachment_url,status,drafted_at,rejected_at,approved_at,remarks` +
        `&limit=-1&sort=transaction_date`
      );
      if (!eRes.ok) return json(eRes.data, { status: eRes.status });
      const expenses = (eRes.data as { data?: unknown[] })?.data ?? [];

      // 3. Get expense ceiling for this user
      const cRes = await directusFetch(
        `/items/user_expense_ceiling?filter[user_id][_eq]=${employeeId}&limit=1`
      );
      const ceilingRow = ((cRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
      const expenseLimit = Number(ceilingRow?.expense_limit ?? 0);

      // 4. Get user info for the salesman
      const uRes = await directusFetch(
        `/items/user?filter[user_id][_eq]=${employeeId}` +
        `&fields=user_id,user_fname,user_mname,user_lname,user_position,user_department&limit=1`
      );
      const userInfo = ((uRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;

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

    // ── GET ?resource=salesmen (default) ──────────────────────────────────
    // 1. Fetch all active salesmen
    const sRes = await directusFetch(
      `/items/salesman?fields=id,salesman_name,salesman_code,employee_id&filter[isActive][_eq]=1&limit=-1&sort=salesman_name`
    );
    if (!sRes.ok) return json(sRes.data, { status: sRes.status });
    const salesmen = (sRes.data as { data?: unknown[] })?.data ?? [] as Record<string, unknown>[];

    if ((salesmen as unknown[]).length === 0) return json({ data: [] });

    // 2. Get all expense_draft (Drafts + Rejected) counts grouped
    const allExpRes = await directusFetch(
      `/items/expense_draft?filter[status][_in]=Drafts,Rejected&fields=id,encoded_by,status&limit=-1`
    );
    const allExpenses = (allExpRes.data as { data?: unknown[] })?.data ?? [] as Record<string, unknown>[];

    // Build map: encoded_by → { draft: count, rejected: count }
    const countMap: Record<number, { draft: number; rejected: number }> = {};
    for (const exp of allExpenses as Record<string, unknown>[]) {
      const uid = Number(exp.encoded_by);
      if (!countMap[uid]) countMap[uid] = { draft: 0, rejected: 0 };
      if (exp.status === "Drafts") countMap[uid].draft++;
      if (exp.status === "Rejected") countMap[uid].rejected++;
    }

    // 3. Map salesmen to employee_id and attach counts — only show those with expenses
    const result = (salesmen as Record<string, unknown>[])
      .map((s) => {
        const empId = Number(s.employee_id);
        const counts = countMap[empId];
        if (!counts || (counts.draft === 0 && counts.rejected === 0)) return null;
        return {
          id: s.id,
          salesman_name: s.salesman_name,
          salesman_code: s.salesman_code,
          employee_id: empId,
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
      salesman_user_id: number; // encoded_by / user_id
      salesman_id: number;      // salesman.id
      device_time?: string;     // local device time
    };

    const { selected_ids, all_ids, remarks, salesman_user_id, device_time } = body;

    if (!all_ids?.length) return json({ error: "No expense IDs provided" }, { status: 400 });

    // Get approver from JWT cookie
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const approverId = token ? decodeJwtSub(token) : null;
    if (!approverId) return json({ error: "Unauthorized: no approver identified" }, { status: 401 });

    // Look up approver's department → get department_id + division_id (parent_division)
    let approverDepartmentId: number | null = null;
    let approverDivisionId: number | null = null;

    const approverUserRes = await directusFetch(
      `/items/user?filter[user_id][_eq]=${approverId}&fields=user_id,user_department&limit=1`
    );
    const approverUser = ((approverUserRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
    if (approverUser?.user_department) {
      approverDepartmentId = Number(approverUser.user_department);
      const deptRes = await directusFetch(
        `/items/department?filter[department_id][_eq]=${approverDepartmentId}&fields=department_id,parent_division&limit=1`
      );
      const dept = ((deptRes.data as { data?: unknown[] })?.data ?? [])[0] as Record<string, unknown> | undefined;
      if (dept?.parent_division) approverDivisionId = Number(dept.parent_division);
    }

    const nowTs = device_time || nowManila();
    const rejectedIds = all_ids.filter((id) => !selected_ids.includes(id));

    // 1. Fetch selected expense details for disbursement building
    let selectedExpenses: Record<string, unknown>[] = [];
    if (selected_ids.length > 0) {
      const eRes = await directusFetch(
        `/items/expense_draft?filter[id][_in]=${selected_ids.join(",")}&fields=id,encoded_by,particulars,amount,transaction_date,attachment_url,remarks&limit=-1`
      );
      selectedExpenses = (eRes.data as { data?: unknown[] })?.data as Record<string, unknown>[] ?? [];
    }

    // 2. Update approved expenses
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

    // 3. Update rejected expenses
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
        payee: salesman_user_id,
        encoder_id: salesman_user_id,
        approver_id: approverId,
        total_amount: totalAmount,
        paid_amount: 0,
        transaction_date: transactionDate,
        division_id: approverDivisionId,
        department_id: approverDepartmentId,
        remarks: remarks || null,
        supporting_documents_url: supportingDocs || null,
        status: "submitted",
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
      division_id: approverDivisionId,
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

