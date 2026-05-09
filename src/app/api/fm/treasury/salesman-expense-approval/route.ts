// src/app/api/fm/treasury/salesman-expense-approval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { startOfWeek, endOfWeek, format } from "date-fns";

export const runtime = "nodejs";

const DIRECTUS_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";
const COOKIE_NAME = "vos_access_token";

const PENDING_EXPENSE_STATUSES = ["Drafts", "Rejected", "With Concern"] as const;
const ALL_EXPENSE_STATUSES = ["Drafts", "Rejected", "With Concern", "Approved"] as const;

type ExpenseDecisionStatus = "Approved" | "Rejected" | "With Concern";

type DirectusListResponse<T> = {
  data?: T[];
};

type DirectusItemResponse<T> = {
  data?: T;
};

type RbacFilters = {
  currentUserId: number;
  myDepartments: number[];
  myDivisions: number[];
};

type SalesmanRow = {
  id: number;
  salesman_name?: string | null;
  salesman_code?: string | null;
  employee_id?: number | string | null;
  division_id?: number | string | null;
};

type UserRow = {
  user_id?: number | string | null;
  user_fname?: string | null;
  user_mname?: string | null;
  user_lname?: string | null;
  user_position?: string | null;
  user_department?: number | string | null;
};

type ExpenseDraftRow = {
  id: number;
  header_id?: number | string | null;
  encoded_by?: number | string | null;
  particulars?: number | string | null;
  division_id?: number | string | null;
  payee_id?: number | string | null;
  transaction_date?: string | null;
  amount?: number | string | null;
  payee?: string | number | null;
  attachment_url?: string | null;
  status?: string | null;
  drafted_at?: string | null;
  rejected_at?: string | null;
  approved_at?: string | null;
  remarks?: string | null;
  version?: number | string | null;
  feedback?: string | null;
};

type DisbursementDraftRow = {
  id: number;
  doc_no?: string | null;
  status?: string | null;
  transaction_date?: string | null;
  payee?: number | string | null;
  encoder_id?: number | string | null;
  total_amount?: number | string | null;
  remarks?: string | null;
  approver_id?: number | string | null;
  date_created?: string | null;
  division_id?: number | string | null;
  approval_version?: number | string | null;
};

type PayableDraftRow = {
  id?: number;
  disbursement_id?: number | string | { id?: number | string } | null;
  expense_id?: number | string | { id?: number | string } | null;
  coa_id?: number | string | null;
  amount?: number | string | null;
  remarks?: string | null;
  date?: string | null;
};

type ApprovalVoteRow = {
  draft_id?: number | string | null;
  approver_id?: number | string | null;
  status?: string | null;
  remarks?: string | null;
  version?: number | string | null;
  created_at?: string | null;
};

type DraftLogRow = {
  id?: number | string | null;
  disbursement_id?: number | string | null;
  updated_by?: number | string | null;
  edit_reason?: string | null;
  payload_snapshot?: string | null;
  log_date?: string | null;
};

type ExpenseLogRow = {
  log_id?: number | string | null;
  expense_id?: number | string | null;
  action?: string | null;
  changed_by?: number | string | null;
  changed_at?: string | null;
  amount?: number | string | null;
  remarks?: string | null;
  particulars?: number | string | null;
  status?: string | null;
  version?: number | string | null;
};

type EditedAmountInput = { id: number; amount: number };

type PostBody = {
  item_decisions: Record<string, { status: ExpenseDecisionStatus; remarks: string }>;
  remarks?: string;
  salesman_id: number;
  all_ids?: number[];
  salesman_user_id?: number;
  edited_amounts?: EditedAmountInput[] | Record<string, number>;
};

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (STATIC_TOKEN) headers.Authorization = `Bearer ${STATIC_TOKEN}`;
  return { ...headers, ...extra };
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}



function directusIn(values: readonly string[]): string {
  return values.map((v) => encodeURIComponent(v)).join(",");
}

function getRelationId(value: unknown): number {
  if (typeof value === "object" && value !== null && "id" in value) {
    return toNumber((value as { id?: unknown }).id);
  }

  return toNumber(value);
}

function getListData<T>(payload: unknown): T[] {
  return ((payload as DirectusListResponse<T>)?.data ?? []) as T[];
}

function getItemData<T>(payload: unknown): T | undefined {
  return (payload as DirectusItemResponse<T>)?.data;
}

async function directusFetch(path: string, init?: RequestInit) {
  if (!DIRECTUS_BASE) {
    return {
      ok: false,
      status: 500,
      data: { error: "NEXT_PUBLIC_API_BASE_URL not set" },
    };
  }

  const cookieStore = await cookies();
  const userToken = cookieStore.get(COOKIE_NAME)?.value;

  const initHeaders =
    init?.headers && !(init.headers instanceof Headers)
      ? (init.headers as Record<string, string>)
      : {};

  const computedHeaders = {
    ...authHeaders(),
    ...initHeaders,
  };

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

  if (ct.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { ok: res.ok, status: res.status, data };
}

function decodeJwtSub(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payloadPart = parts[1];
    const b64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    const payload = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8")
    ) as Record<string, unknown>;

    const sub = payload.sub ?? payload.user_id ?? payload.id;
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

function todayManila(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Manila" });
}

function getUserFullName(user: UserRow): string {
  return `${user.user_fname ?? ""} ${user.user_lname ?? ""}`.trim();
}

function makeExpenseDecisionPatch(
  decision: { status: ExpenseDecisionStatus; remarks: string },
  nowTs: string
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    status: decision.status,
    feedback: decision.status !== "Approved" ? decision.remarks || null : null,
  };

  if (decision.status === "Approved") {
    patch.approved_at = nowTs;
    patch.rejected_at = null;
  }

  if (decision.status === "Rejected") {
    patch.rejected_at = nowTs;
    patch.approved_at = null;
  }

  if (decision.status === "With Concern") {
    patch.approved_at = null;
    patch.rejected_at = null;
  }

  return patch;
}

async function getRbacFilters(): Promise<RbacFilters | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const currentUserId = token ? decodeJwtSub(token) : null;

  if (!currentUserId) return null;

  const [deptRes, supRes] = await Promise.all([
    directusFetch(
      `/items/department?filter[department_head_id][_eq]=${currentUserId}&fields=department_id&limit=-1`
    ),
    directusFetch(
      `/items/supervisor_per_division?filter[supervisor_id][_eq]=${currentUserId}&filter[is_deleted][_eq]=0&fields=division_id&limit=-1`
    ),
  ]);

  const deptRows = getListData<{ department_id?: number | string }>(deptRes.data);
  const supRows = getListData<{ division_id?: number | string }>(supRes.data);

  const myDepartments = deptRows
    .map((d) => toNumber(d.department_id))
    .filter((id) => id > 0);

  const myDivisions = supRows
    .map((s) => toNumber(s.division_id))
    .filter((id) => id > 0);

  return { currentUserId, myDepartments, myDivisions };
}

export async function GET(req: NextRequest) {
  try {
    const rbac = await getRbacFilters();

    if (!rbac) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentUserId, myDepartments, myDivisions } = rbac;
    const isAuthorized = myDepartments.length > 0 || myDivisions.length > 0;

    if (!isAuthorized) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const resource = sp.get("resource") || "salesmen";
    const startDate = sp.get("start_date");
    const endDate = sp.get("end_date");

    if (resource === "expenses") {
      const salesmanId = sp.get("salesman_id");

      if (!salesmanId) {
        return json({ error: "Missing salesman_id" }, { status: 400 });
      }

      const sRes = await directusFetch(
        `/items/salesman?filter[id][_eq]=${salesmanId}&fields=id,salesman_name,salesman_code,employee_id,division_id&limit=1`
      );

      if (!sRes.ok) return json(sRes.data, { status: sRes.status });

      const salesman = getListData<SalesmanRow>(sRes.data)[0];

      if (!salesman) {
        return json({ error: "Salesman not found" }, { status: 404 });
      }

      const employeeId = toNumber(salesman.employee_id);
      const salesmanDivisionId = toNumber(salesman.division_id);

      const uRes = await directusFetch(
        `/items/user?filter[user_id][_eq]=${employeeId}` +
        `&fields=user_id,user_fname,user_mname,user_lname,user_position,user_department&limit=1`
      );

      const userInfo = getListData<UserRow>(uRes.data)[0];
      const salesmanDeptId = userInfo?.user_department
        ? toNumber(userInfo.user_department)
        : 0;

      const isMyDept = myDepartments.includes(salesmanDeptId);
      const isMyDiv = myDivisions.includes(salesmanDivisionId);

      if (!isMyDept && !isMyDiv) {
        return json({ error: "Forbidden" }, { status: 403 });
      }

      let expFilter =
        `/items/expense_draft?filter[encoded_by][_eq]=${employeeId}` +
        `&filter[division_id][_eq]=${salesmanDivisionId}` +
        `&filter[status][_in]=${directusIn(ALL_EXPENSE_STATUSES)}`;

      if (startDate && endDate) {
        expFilter += `&filter[transaction_date][_between]=[${startDate},${endDate}]`;
      }

      const eRes = await directusFetch(
        expFilter +
        `&fields=id,header_id,encoded_by,particulars,transaction_date,amount,payee,payee_id,attachment_url,status,drafted_at,rejected_at,approved_at,remarks,division_id,version,feedback` +
        `&limit=-1&sort=transaction_date`
      );

      if (!eRes.ok) return json(eRes.data, { status: eRes.status });

      const expenses = getListData<ExpenseDraftRow>(eRes.data);

      const cRes = await directusFetch(
        `/items/user_expense_ceiling?filter[user_id][_eq]=${employeeId}&limit=1`
      );

      const ceilingRow = getListData<{ expense_limit?: number | string }>(
        cRes.data
      )[0];

      const expenseLimit = toNumber(ceilingRow?.expense_limit);

      let resolvedDivisionId: number | null = null;
      let departmentName = "";
      let divisionName = "";

      if (userInfo?.user_department) {
        const dRes = await directusFetch(
          `/items/department?filter[department_id][_eq]=${userInfo.user_department}&fields=department_id,department_name,parent_division&limit=1`
        );

        const dept = getListData<{
          department_id?: number | string;
          department_name?: string;
          parent_division?: number | string;
        }>(dRes.data)[0];

        if (dept) {
          departmentName = String(dept.department_name ?? "");

          if (dept.parent_division) {
            resolvedDivisionId = toNumber(dept.parent_division);

            const divRes = await directusFetch(
              `/items/division?filter[division_id][_eq]=${resolvedDivisionId}&fields=division_name&limit=1`
            );

            const div = getListData<{ division_name?: string }>(divRes.data)[0];

            if (div) {
              divisionName = String(div.division_name ?? "");
            }
          }
        }
      }

      const coaIds = [
        ...new Set(
          expenses.map((e) => toNumber(e.particulars)).filter((id) => id > 0)
        ),
      ];

      const coaMap: Record<number, string> = {};

      if (coaIds.length > 0) {
        const coaRes = await directusFetch(
          `/items/chart_of_accounts?filter[coa_id][_in]=${coaIds.join(",")}&fields=coa_id,account_title,gl_code&limit=-1`
        );

        const coaRows = getListData<{
          coa_id?: number | string;
          account_title?: string;
        }>(coaRes.data);

        for (const coa of coaRows) {
          coaMap[toNumber(coa.coa_id)] = String(coa.account_title ?? "");
        }
      }

      const enriched = expenses.map((e) => ({
        ...e,
        particulars_name: coaMap[toNumber(e.particulars)] ?? "",
      }));

      return json({
        salesman: {
          ...salesman,
          user: userInfo ?? null,
          division_id: resolvedDivisionId,
          department_name: departmentName,
          division_name: divisionName,
        },
        expense_limit: expenseLimit,
        expenses: enriched,
      });
    }

    if (resource === "logs") {
      const disbRes = await directusFetch(
        `/items/disbursement_draft?filter[transaction_type][_eq]=2&sort=-id&limit=200&fields=id,doc_no,status,transaction_date,payee,encoder_id,total_amount,remarks,approver_id,date_created,division_id`
      );

      if (!disbRes.ok) return json(disbRes.data, { status: disbRes.status });

      const logs = getListData<DisbursementDraftRow>(disbRes.data);

      const uids = new Set<number>();

      for (const log of logs) {
        if (log.payee) uids.add(toNumber(log.payee));
        if (log.encoder_id) uids.add(toNumber(log.encoder_id));
        if (log.approver_id) uids.add(toNumber(log.approver_id));
      }

      const userMap: Record<number, string> = {};
      const userDeptMap: Record<number, number> = {};

      if (uids.size > 0) {
        const uRes = await directusFetch(
          `/items/user?filter[user_id][_in]=${[...uids].join(",")}&fields=user_id,user_fname,user_lname,user_department&limit=-1`
        );

        const users = getListData<UserRow>(uRes.data);

        for (const user of users) {
          const userId = toNumber(user.user_id);
          userMap[userId] = getUserFullName(user);
          userDeptMap[userId] = toNumber(user.user_department);
        }
      }

      const visibleLogs = logs
        .filter((log) => {
          const isMyApproval = toNumber(log.approver_id) === currentUserId;
          const targetDept =
            userDeptMap[toNumber(log.encoder_id)] ||
            userDeptMap[toNumber(log.payee)] ||
            0;
          const isMyDept = myDepartments.includes(targetDept);
          const isMyDiv = myDivisions.includes(toNumber(log.division_id));

          return isMyApproval || isMyDept || isMyDiv;
        })
        .slice(0, 50);

      const logIds = visibleLogs.map((l) => toNumber(l.id)).filter((id) => id > 0);

      if (logIds.length === 0) {
        return json({ data: [] });
      }

      const [vRes, dlRes, pResForIds] = await Promise.all([
        directusFetch(
          `/items/disbursement_draft_approvals?filter[draft_id][_in]=${logIds.join(",")}&filter[status][_neq]=DRAFT&fields=draft_id,approver_id,status,remarks,version,created_at&sort=version,created_at&limit=-1`
        ),
        directusFetch(
          `/items/disbursement_draft_logs?filter[disbursement_id][_in]=${logIds.join(",")}&fields=id,disbursement_id,updated_by,edit_reason,payload_snapshot,log_date&sort=-log_date&limit=-1`
        ),
        directusFetch(
          `/items/disbursement_payables_draft?filter[disbursement_id][_in]=${logIds.join(",")}&fields=expense_id,disbursement_id&limit=-1`
        ),
      ]);

      const allVotes = getListData<ApprovalVoteRow>(vRes.data);
      const allDraftLogs = getListData<DraftLogRow>(dlRes.data);
      const pRowsForIds = getListData<PayableDraftRow>(pResForIds.data);

      const expenseIdsForAudit = [
        ...new Set(
          pRowsForIds
            .map((pr) => getRelationId(pr.expense_id))
            .filter((id) => id > 0)
        ),
      ];

      let allExpenseLogs: ExpenseLogRow[] = [];

      if (expenseIdsForAudit.length > 0) {
        const finalElRes = await directusFetch(
          `/items/expense_draft_logs?filter[expense_id][_in]=${expenseIdsForAudit.join(",")}&fields=log_id,expense_id,action,changed_by,changed_at,amount,remarks,particulars,status,version&limit=-1`
        );

        allExpenseLogs = getListData<ExpenseLogRow>(finalElRes.data);
      }

      const voteUids = [
        ...new Set(
          [
            ...allVotes.map((v) => toNumber(v.approver_id)),
            ...allDraftLogs.map((l) => toNumber(l.updated_by)),
            ...allExpenseLogs.map((l) => toNumber(l.changed_by)),
          ].filter((id) => id > 0)
        ),
      ];

      const missingUids = voteUids.filter((uid) => !userMap[uid]);

      if (missingUids.length > 0) {
        const uRes = await directusFetch(
          `/items/user?filter[user_id][_in]=${missingUids.join(",")}&fields=user_id,user_fname,user_lname&limit=-1`
        );

        const users = getListData<UserRow>(uRes.data);

        for (const user of users) {
          userMap[toNumber(user.user_id)] = getUserFullName(user);
        }
      }

      const coaIdsForLogs = [
        ...new Set(
          allExpenseLogs
            .map((l) => toNumber(l.particulars))
            .filter((id) => id > 0)
        ),
      ];

      const coaMapForLogs: Record<number, string> = {};

      if (coaIdsForLogs.length > 0) {
        const cRes = await directusFetch(
          `/items/chart_of_accounts?filter[coa_id][_in]=${coaIdsForLogs.join(",")}&fields=coa_id,account_title&limit=-1`
        );

        const coaRows = getListData<{
          coa_id?: number | string;
          account_title?: string;
        }>(cRes.data);

        for (const coa of coaRows) {
          coaMapForLogs[toNumber(coa.coa_id)] = String(coa.account_title ?? "");
        }
      }

      const formattedLogs = visibleLogs.map((log) => {
        const logId = toNumber(log.id);

        const logVotes = allVotes
          .filter((v) => toNumber(v.draft_id) === logId)
          .map((v) => ({
            approver_name:
              userMap[toNumber(v.approver_id)] || `User #${v.approver_id}`,
            status: String(v.status ?? ""),
            remarks: v.remarks ? String(v.remarks) : null,
            version: toNumber(v.version, 1),
            created_at: String(v.created_at ?? ""),
          }));

        const draftLogs = allDraftLogs
          .filter((l) => toNumber(l.disbursement_id) === logId)
          .map((l) => {
            let snapshot: { old_total?: number; new_total?: number } = {};

            try {
              snapshot = JSON.parse(String(l.payload_snapshot || "{}")) as {
                old_total?: number;
                new_total?: number;
              };
            } catch {
              snapshot = {};
            }

            return {
              id: toNumber(l.id),
              editor_name:
                userMap[toNumber(l.updated_by)] || `User #${l.updated_by}`,
              edit_reason: String(l.edit_reason || ""),
              old_total: toNumber(snapshot.old_total),
              new_total: toNumber(snapshot.new_total),
              created_at: String(l.log_date || ""),
            };
          });

        const currentExpenseIds = pRowsForIds
          .filter((pr) => getRelationId(pr.disbursement_id) === logId)
          .map((pr) => getRelationId(pr.expense_id))
          .filter((id) => id > 0);

        const expenseLogs = allExpenseLogs
          .filter((l) => currentExpenseIds.includes(toNumber(l.expense_id)))
          .map((l) => ({
            log_id: toNumber(l.log_id),
            expense_id: toNumber(l.expense_id),
            action: String(l.action || ""),
            editor_name:
              userMap[toNumber(l.changed_by)] || `User #${l.changed_by}`,
            changed_at: String(l.changed_at || ""),
            amount: toNumber(l.amount),
            remarks: l.remarks ? String(l.remarks) : null,
            particulars:
              coaMapForLogs[toNumber(l.particulars)] ||
              String(l.particulars || ""),
            status: String(l.status || ""),
            version: toNumber(l.version, 1),
          }));

        return {
          id: log.id,
          doc_no: log.doc_no,
          transaction_date: log.transaction_date,
          salesman_name:
            userMap[toNumber(log.encoder_id)] ||
            userMap[toNumber(log.payee)] ||
            `User #${log.encoder_id || log.payee}`,
          total_amount: toNumber(log.total_amount),
          remarks: log.remarks,
          approver_name:
            userMap[toNumber(log.approver_id)] || `User #${log.approver_id}`,
          status: log.status,
          date_created: log.date_created,
          votes: logVotes,
          logs: draftLogs,
          expense_logs: expenseLogs,
        };
      });

      return json({ data: formattedLogs });
    }

    if (resource === "log-details") {
      const disbId = sp.get("disbursement_id");

      if (!disbId) {
        return json({ error: "Disbursement ID required" }, { status: 400 });
      }

      const pRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${disbId}&fields=id,coa_id,amount,remarks,date&limit=-1`
      );

      if (!pRes.ok) return json(pRes.data, { status: pRes.status });

      const payables = getListData<PayableDraftRow>(pRes.data);

      const coaIds = [
        ...new Set(
          payables.map((p) => toNumber(p.coa_id)).filter((id) => id > 0)
        ),
      ];

      const coaMap: Record<number, string> = {};

      if (coaIds.length > 0) {
        const cRes = await directusFetch(
          `/items/chart_of_accounts?filter[coa_id][_in]=${coaIds.join(",")}&fields=coa_id,account_title&limit=-1`
        );

        const coaRows = getListData<{
          coa_id?: number | string;
          account_title?: string;
        }>(cRes.data);

        for (const coa of coaRows) {
          coaMap[toNumber(coa.coa_id)] = String(coa.account_title ?? "");
        }
      }

      const formattedPayables = payables.map((p) => ({
        id: p.id,
        coa_name: coaMap[toNumber(p.coa_id)] || `COA #${p.coa_id}`,
        amount: p.amount,
        remarks: p.remarks,
        date: p.date,
      }));

      return json({ data: formattedPayables });
    }

    if (resource === "available-weeks") {
      const eRes = await directusFetch(
        `/items/expense_draft?filter[status][_in]=${directusIn(
          PENDING_EXPENSE_STATUSES
        )}&filter[approved_at][_null]=true&fields=transaction_date&limit=-1`
      );

      if (!eRes.ok) return json(eRes.data, { status: eRes.status });

      const raw = getListData<ExpenseDraftRow>(eRes.data);

      const weekMap: Record<
        string,
        { week_start: string; week_end: string; week_label: string }
      > = {};

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
            week_label: `${format(wStart, "MMM d")} - ${format(
              wEnd,
              "d, yyyy"
            )}`,
          };
        }
      }

      return json({
        data: Object.values(weekMap).sort((a, b) =>
          b.week_start.localeCompare(a.week_start)
        ),
      });
    }

    const sRes = await directusFetch(
      `/items/salesman?fields=id,salesman_name,salesman_code,employee_id,division_id&filter[isActive][_eq]=1&limit=-1&sort=salesman_name`
    );

    if (!sRes.ok) return json(sRes.data, { status: sRes.status });

    const salesmen = getListData<SalesmanRow>(sRes.data);

    if (salesmen.length === 0) {
      return json({ data: [] });
    }

    const uids = [
      ...new Set(
        salesmen.map((s) => toNumber(s.employee_id)).filter((id) => id > 0)
      ),
    ];

    const userDeptMap: Record<number, number> = {};

    if (uids.length > 0) {
      const uRes = await directusFetch(
        `/items/user?filter[user_id][_in]=${uids.join(",")}&fields=user_id,user_department&limit=-1`
      );

      const users = getListData<UserRow>(uRes.data);

      for (const user of users) {
        const userId = toNumber(user.user_id);
        const deptId = toNumber(user.user_department);

        if (userId > 0 && deptId > 0) {
          userDeptMap[userId] = deptId;
        }
      }
    }

    let expFilterBase =
      `/items/expense_draft?filter[status][_in]=${directusIn(
        PENDING_EXPENSE_STATUSES
      )}` + `&filter[approved_at][_null]=true`;

    if (startDate && endDate) {
      expFilterBase += `&filter[transaction_date][_between]=[${startDate},${endDate}]`;
    }

    const allExpRes = await directusFetch(
      `${expFilterBase}&fields=id,encoded_by,division_id,status,transaction_date,approved_at&limit=-1`
    );

    if (!allExpRes.ok) {
      return json(allExpRes.data, { status: allExpRes.status });
    }

    const rawExpenses = getListData<ExpenseDraftRow>(allExpRes.data);

    const allExpenses = rawExpenses.filter((exp) => {
      const salesmanDeptId = userDeptMap[toNumber(exp.encoded_by)] || 0;
      const isMyDept = myDepartments.includes(salesmanDeptId);
      const isMyDiv = myDivisions.includes(toNumber(exp.division_id));

      return isMyDept || isMyDiv;
    });

    const countMap: Record<
      string,
      {
        draft: number;
        rejected: number;
        week_start: string;
        week_end: string;
        week_label: string;
      }
    > = {};

    for (const exp of allExpenses) {
      if (!exp.transaction_date) continue;

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
          week_label: `${format(wStart, "MMM d")} - ${format(
            wEnd,
            "d, yyyy"
          )}`,
        };
      }

      if (exp.status === "Drafts" || exp.status === "With Concern") {
        countMap[key].draft += 1;
      }

      if (exp.status === "Rejected") {
        countMap[key].rejected += 1;
      }
    }

    const divisionIds = [
      ...new Set(
        salesmen.map((s) => toNumber(s.division_id)).filter((id) => id > 0)
      ),
    ];

    const divisionNameMap: Record<number, string> = {};

    if (divisionIds.length > 0) {
      const divRes = await directusFetch(
        `/items/division?filter[division_id][_in]=${divisionIds.join(",")}&fields=division_id,division_name&limit=-1`
      );

      const divisions = getListData<{
        division_id?: number | string;
        division_name?: string;
      }>(divRes.data);

      for (const div of divisions) {
        divisionNameMap[toNumber(div.division_id)] = String(
          div.division_name ?? ""
        );
      }
    }

    const result = salesmen
      .map((s) => {
        const employeeId = toNumber(s.employee_id);
        const divisionId = toNumber(s.division_id);

        const prefix = `${employeeId}_${divisionId}_`;
        const relevantKeys = Object.keys(countMap).filter((key) =>
          key.startsWith(prefix)
        );

        if (relevantKeys.length === 0) return null;

        let totalDraft = 0;
        let totalRejected = 0;
        let weekLabel = "";
        let weekStart = "";
        let weekEnd = "";

        for (const key of relevantKeys) {
          totalDraft += countMap[key].draft;
          totalRejected += countMap[key].rejected;

          if (!weekLabel) {
            weekLabel = countMap[key].week_label;
            weekStart = countMap[key].week_start;
            weekEnd = countMap[key].week_end;
          }
        }

        return {
          id: s.id,
          salesman_name: s.salesman_name,
          salesman_code: s.salesman_code,
          employee_id: s.employee_id,
          division_id: divisionId || null,
          division_name: divisionId ? divisionNameMap[divisionId] ?? null : null,
          draft_count: totalDraft,
          rejected_count: totalRejected,
          week_start: weekStart,
          week_end: weekEnd,
          week_label: weekLabel,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return json({ data: result });
  } catch (e: unknown) {
    return json(
      {
        error: "Server error",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PostBody;

    const {
      item_decisions: itemDecisions,
      remarks = "",
      salesman_id: salesmanId,
    } = body;

    let { all_ids: allIds, salesman_user_id: salesmanUserId } = body;
    const { edited_amounts } = body;

    if (!itemDecisions || Object.keys(itemDecisions).length === 0) {
      return json({ error: "No decisions provided" }, { status: 400 });
    }

    if (!allIds || allIds.length === 0) {
      allIds = Object.keys(itemDecisions)
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
    }



    let salesmanDivisionId: number | null = null;
    let salesmanDepartmentId: number | null = null;

    const sRes = await directusFetch(
      `/items/salesman?filter[id][_eq]=${salesmanId}&fields=id,division_id,employee_id&limit=1`
    );

    const salesman = getListData<SalesmanRow>(sRes.data)[0];

    if (salesman?.division_id) {
      salesmanDivisionId = toNumber(salesman.division_id);
    }

    if (!salesmanUserId && salesman?.employee_id) {
      salesmanUserId = toNumber(salesman.employee_id);
    }

    if (!salesmanUserId) {
      return json({ error: "Could not resolve salesman user ID" }, { status: 400 });
    }

    const uRes = await directusFetch(
      `/items/user?filter[user_id][_eq]=${salesmanUserId}&fields=user_id,user_department&limit=1`
    );

    const user = getListData<UserRow>(uRes.data)[0];

    if (user?.user_department) {
      salesmanDepartmentId = toNumber(user.user_department);
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const approverId = token ? decodeJwtSub(token) : null;

    if (!approverId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const nowTs = nowManila();

    const eRes = await directusFetch(
      `/items/expense_draft?filter[encoded_by][_eq]=${salesmanUserId}` +
      `&filter[status][_in]=${directusIn(ALL_EXPENSE_STATUSES)}` +
      `&fields=id,header_id,encoded_by,particulars,amount,transaction_date,attachment_url,remarks,division_id,payee,payee_id,status,version&limit=-1`
    );

    if (!eRes.ok) return json(eRes.data, { status: eRes.status });

    const allRelevantRows = getListData<ExpenseDraftRow>(eRes.data);

    const allDetailRows = allRelevantRows.filter((row) =>
      allIds.includes(toNumber(row.id))
    );

    if (allDetailRows.length === 0) {
      return json({ error: "No matching expense rows found" }, { status: 404 });
    }

    const editedIds: number[] = [];

    if (edited_amounts) {
      const normalizedAmounts: Record<string, number> = Array.isArray(
        edited_amounts
      )
        ? Object.fromEntries(
          edited_amounts.map((item) => [String(item.id), item.amount])
        )
        : edited_amounts;

      for (const [idStr, newAmount] of Object.entries(normalizedAmounts)) {
        const id = Number(idStr);

        if (!Number.isFinite(id)) continue;

        editedIds.push(id);

        const original = allDetailRows.find((e) => toNumber(e.id) === id);

        if (!original) continue;

        const decision = itemDecisions[String(id)];
        const finalStatus = decision?.status || original.status || "Drafts";
        const newVersion = toNumber(original.version, 1) + 1;

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

        const updateObj: Record<string, unknown> = {
          amount: newAmount,
          version: newVersion,
        };

        if (decision) {
          Object.assign(updateObj, makeExpenseDecisionPatch(decision, nowTs));
        }

        const patchRes = await directusFetch(`/items/expense_draft/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(updateObj),
        });

        if (!patchRes.ok) return json(patchRes.data, { status: patchRes.status });

        original.amount = newAmount;
        original.version = newVersion;
        if (decision) {
          original.status = decision.status;
          original.feedback = decision.status !== "Approved" ? decision.remarks : null;
          original.approved_at = decision.status === "Approved" ? nowTs : null;
          original.rejected_at = decision.status === "Rejected" ? nowTs : null;
        }
      }
    }

    for (const id of allIds) {
      if (editedIds.includes(id)) continue;

      const decision = itemDecisions[String(id)];
      const original = allDetailRows.find((e) => toNumber(e.id) === id);

      if (!decision || !original) continue;

      const updateData = makeExpenseDecisionPatch(decision, nowTs);

      const patchRes = await directusFetch(`/items/expense_draft/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!patchRes.ok) return json(patchRes.data, { status: patchRes.status });

      original.status = decision.status;
      original.feedback = decision.status !== "Approved" ? decision.remarks : null;
      original.approved_at = decision.status === "Approved" ? nowTs : null;
      original.rejected_at = decision.status === "Rejected" ? nowTs : null;
    }

    const selectedExpenses = allRelevantRows.filter((row) => {
      const rowId = String(row.id);
      const decision = itemDecisions[rowId];

      if (decision) return decision.status === "Approved";

      return row.status === "Approved";
    });

    if (selectedExpenses.length === 0) {
      return json({
        ok: true,
        disbursement_id: null,
        message: "All items processed. No approved expenses to consolidate.",
      });
    }

    let disbursementId: number | null = null;
    let docNo: string | null = null;
    let approvalVersion = 1;

    const selectedExpenseIds = selectedExpenses
      .map((row) => toNumber(row.id))
      .filter((id) => id > 0);

    if (selectedExpenseIds.length > 0) {
      const existingPayRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[expense_id][_in]=${selectedExpenseIds.join(",")}&fields=disbursement_id&limit=1`
      );

      const existingPayRows = getListData<PayableDraftRow>(existingPayRes.data);

      if (existingPayRows.length > 0) {
        const existingDisbursementId = getRelationId(
          existingPayRows[0].disbursement_id
        );

        if (existingDisbursementId > 0) {
          const dRes = await directusFetch(
            `/items/disbursement_draft/${existingDisbursementId}?fields=id,doc_no,approval_version,total_amount`
          );

          const dRow = getItemData<DisbursementDraftRow>(dRes.data);

          if (dRow) {
            disbursementId = toNumber(dRow.id);
            docNo = String(dRow.doc_no ?? "");
            approvalVersion = toNumber(dRow.approval_version, 1) + 1;
          }
        }
      }
    }

    const totalAmount = selectedExpenses.reduce(
      (sum, e) => sum + toNumber(e.amount),
      0
    );

    const supportingDocs = selectedExpenses
      .filter((e) => e.attachment_url)
      .map((e) => e.attachment_url)
      .join(",");

    if (disbursementId) {
      const updateDisbRes = await directusFetch(
        `/items/disbursement_draft/${disbursementId}`,
        {
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
        }
      );

      if (!updateDisbRes.ok) {
        return json(updateDisbRes.data, { status: updateDisbRes.status });
      }

      const oldPayRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${disbursementId}&fields=id&limit=-1`
      );

      const oldPayIds = getListData<{ id?: number | string }>(oldPayRes.data)
        .map((p) => toNumber(p.id))
        .filter((id) => id > 0);

      if (oldPayIds.length > 0) {
        const deletePayRes = await directusFetch(
          `/items/disbursement_payables_draft`,
          {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(oldPayIds),
          }
        );

        if (!deletePayRes.ok) {
          return json(deletePayRes.data, { status: deletePayRes.status });
        }
      }
    } else {
      const latestRes = await directusFetch(
        `/items/disbursement_draft?filter[doc_no][_starts_with]=NT-&sort=-id&limit=1&fields=doc_no`
      );

      const latestDoc = getListData<{ doc_no?: string }>(latestRes.data)[0]
        ?.doc_no;

      let nextNum = 1000;

      if (latestDoc) {
        const match = latestDoc.match(/NT-(\d+)/);

        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }

      docNo = `NT-${nextNum}`;

      const firstSelected = selectedExpenses[0];

      const newDisbRes = await directusFetch(`/items/disbursement_draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doc_no: docNo,
          transaction_type: 2,
          payee: firstSelected?.payee_id || salesmanUserId,
          encoder_id: salesmanUserId,
          approver_id: approverId,
          total_amount: totalAmount,
          transaction_date: firstSelected?.transaction_date || todayManila(),
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

      if (!newDisbRes.ok) {
        return json(newDisbRes.data, { status: newDisbRes.status });
      }

      const newDisb = getItemData<{ id?: number | string }>(newDisbRes.data);
      disbursementId = toNumber(newDisb?.id);

      if (!disbursementId) {
        return json(
          { error: "Failed to create disbursement draft" },
          { status: 500 }
        );
      }
    }

    const payables = selectedExpenses.map((e) => ({
      disbursement_id: disbursementId,
      expense_id: toNumber(e.id),
      division_id: salesmanDivisionId,
      reference_no: docNo,
      date: e.transaction_date,
      coa_id: toNumber(e.particulars),
      amount: toNumber(e.amount),
      remarks: e.remarks || null,
      version: toNumber(e.version, 1),
      date_created: nowTs,
    }));

    const payablesRes = await directusFetch(`/items/disbursement_payables_draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payables),
    });

    if (!payablesRes.ok) {
      return json(payablesRes.data, { status: payablesRes.status });
    }

    return json({
      ok: true,
      disbursement_id: disbursementId,
      doc_no: docNo,
    });
  } catch (e: unknown) {
    return json(
      {
        error: "Server error",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}