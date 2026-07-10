// src/app/api/fm/treasury/salesman-expense-approval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";
const COOKIE_NAME = "vos_access_token";

const PENDING_EXPENSE_STATUSES = ["Drafts", "Rejected", "With Concern"] as const;
const ALL_EXPENSE_STATUSES = [
  "Drafts",
  "Rejected",
  "With Concern",
  "Approved",
] as const;



type DirectusListResponse<T> = {
  data?: T[];
};



type DirectusFetchResult = {
  ok: boolean;
  status: number;
  data: unknown;
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

type DepartmentRow = {
  department_id?: number | string | null;
  department_name?: string | null;
  parent_division?: number | string | null;
};

type DivisionRow = {
  division_id?: number | string | null;
  division_name?: string | null;
};

type ExpenseDraftRow = {
  id: number;
  header_id?: number | string | { id?: number | string | null } | null;
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
  is_supervisor?: number | string | null;
};

type EnrichedExpenseDraftRow = ExpenseDraftRow & {
  particulars_name: string;
};

type ExpenseDraftHeaderRow = {
  id?: number | string | null;
  period_from?: string | null;
  period_to?: string | null;
  remarks?: string | null;
  status?: string | null;
};

type FormattedExpenseDraftHeader = {
  id: number;
  period_from: string;
  period_to: string;
  remarks: string | null;
  status: string;
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
  id?: number | string | null;
  disbursement_id?: number | string | { id?: number | string | null } | null;
  expense_id?: number | string | { id?: number | string | null } | null;
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





type DecodedJwtPayload = {
  sub?: string | number;
  user_id?: string | number;
  id?: string | number;
};

type SalesmanSummaryRow = {
  id: number;
  salesman_name: string;
  salesman_code: string | null;
  employee_id: number;
  division_id: number | null;
  division_name: string | null;
  draft_count: number;
  rejected_count: number;
  concern_count: number;
  pending_amount: number;
  header_count: number;
};

type CountBucket = {
  draft: number;
  rejected: number;
  concern: number;
  amount: number;
  headers: Set<number>;
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

function uniquePositiveNumbers(values: unknown[]): number[] {
  return [...new Set(values.map((value) => toNumber(value)).filter((id) => id > 0))];
}

function directusIn(values: readonly string[]): string {
  return values.map((value) => encodeURIComponent(value)).join(",");
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



function withDateFilters(path: string, startDate: string | null, endDate: string | null): string {
  let nextPath = path;

  if (startDate) {
    nextPath += `&filter[transaction_date][_gte]=${encodeURIComponent(startDate)}`;
  }

  if (endDate) {
    nextPath += `&filter[transaction_date][_lte]=${encodeURIComponent(endDate)}`;
  }

  return nextPath;
}

function getUserFullName(user?: UserRow | null): string {
  if (!user) return "";

  return [user.user_fname, user.user_mname, user.user_lname]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

async function directusFetch(path: string, init?: RequestInit): Promise<DirectusFetchResult> {
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

  const contentType = res.headers.get("content-type") || "";
  const data: unknown = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  return { ok: res.ok, status: res.status, data };
}

function decodeJwtSub(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payloadPart = parts[1];
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    const payload = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8")
    ) as DecodedJwtPayload;

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
    .map((dept) => toNumber(dept.department_id))
    .filter((id) => id > 0);

  const myDivisions = supRows
    .map((sup) => toNumber(sup.division_id))
    .filter((id) => id > 0);

  return { currentUserId, myDepartments, myDivisions };
}

function canAccessScope(rbac: RbacFilters, departmentId: number, divisionId: number): boolean {
  return rbac.myDepartments.includes(departmentId) || rbac.myDivisions.includes(divisionId);
}

async function fetchUserMap(userIds: number[]): Promise<Record<number, UserRow>> {
  const userMap: Record<number, UserRow> = {};

  if (userIds.length === 0) return userMap;

  const uRes = await directusFetch(
    `/items/user?filter[user_id][_in]=${userIds.join(",")}&fields=user_id,user_fname,user_mname,user_lname,user_position,user_department&limit=-1`
  );

  const users = getListData<UserRow>(uRes.data);

  for (const user of users) {
    const userId = toNumber(user.user_id);
    if (userId > 0) userMap[userId] = user;
  }

  return userMap;
}

async function fetchDivisionNameMap(divisionIds: number[]): Promise<Record<number, string>> {
  const divisionNameMap: Record<number, string> = {};

  if (divisionIds.length === 0) return divisionNameMap;

  const divRes = await directusFetch(
    `/items/division?filter[division_id][_in]=${divisionIds.join(",")}&fields=division_id,division_name&limit=-1`
  );

  const divisions = getListData<DivisionRow>(divRes.data);

  for (const division of divisions) {
    const divisionId = toNumber(division.division_id);
    if (divisionId > 0) {
      divisionNameMap[divisionId] = String(division.division_name ?? "");
    }
  }

  return divisionNameMap;
}

async function fetchSalesmenByEmployeeIds(employeeIds: number[]): Promise<Record<number, SalesmanRow>> {
  const salesmanMap: Record<number, SalesmanRow> = {};

  if (employeeIds.length === 0) return salesmanMap;

  const sRes = await directusFetch(
    `/items/salesman?filter[employee_id][_in]=${employeeIds.join(",")}&fields=id,salesman_name,salesman_code,employee_id,division_id&limit=-1&sort=salesman_name`
  );

  const salesmen = getListData<SalesmanRow>(sRes.data);

  for (const salesman of salesmen) {
    const employeeId = toNumber(salesman.employee_id);
    if (employeeId > 0 && !salesmanMap[employeeId]) {
      salesmanMap[employeeId] = salesman;
    }
  }

  return salesmanMap;
}

async function resolveSalesmanFromParam(salesmanIdParam: string): Promise<{
  salesman: SalesmanRow | null;
  employeeId: number;
}> {
  const directSalesmanRes = await directusFetch(
    `/items/salesman?filter[id][_eq]=${encodeURIComponent(salesmanIdParam)}&fields=id,salesman_name,salesman_code,employee_id,division_id&limit=1`
  );

  const directSalesman = getListData<SalesmanRow>(directSalesmanRes.data)[0];

  if (directSalesman) {
    return {
      salesman: directSalesman,
      employeeId: toNumber(directSalesman.employee_id),
    };
  }

  const byEmployeeRes = await directusFetch(
    `/items/salesman?filter[employee_id][_eq]=${encodeURIComponent(salesmanIdParam)}&fields=id,salesman_name,salesman_code,employee_id,division_id&limit=1`
  );

  const byEmployeeSalesman = getListData<SalesmanRow>(byEmployeeRes.data)[0];

  if (byEmployeeSalesman) {
    return {
      salesman: byEmployeeSalesman,
      employeeId: toNumber(byEmployeeSalesman.employee_id),
    };
  }

  return {
    salesman: null,
    employeeId: toNumber(salesmanIdParam),
  };
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

      const { salesman, employeeId } = await resolveSalesmanFromParam(salesmanId);

      if (!employeeId) {
        return json({ error: "Salesman or encoder user not found" }, { status: 404 });
      }

      const uRes = await directusFetch(
        `/items/user?filter[user_id][_eq]=${employeeId}` +
        `&fields=user_id,user_fname,user_mname,user_lname,user_position,user_department&limit=1`
      );

      const userInfo = getListData<UserRow>(uRes.data)[0];
      const salesmanDeptId = toNumber(userInfo?.user_department);
      const salesmanDivisionId = toNumber(salesman?.division_id);

      if (!canAccessScope(rbac, salesmanDeptId, salesmanDivisionId)) {
        return json({ error: "Forbidden" }, { status: 403 });
      }

      let expFilter =
        `/items/expense_draft?filter[encoded_by][_eq]=${employeeId}` +
        `&filter[status][_in]=${directusIn(ALL_EXPENSE_STATUSES)}`;

      expFilter = withDateFilters(expFilter, startDate, endDate);

      const eRes = await directusFetch(
        expFilter +
        `&fields=id,header_id,encoded_by,particulars,transaction_date,amount,payee,payee_id,attachment_url,status,drafted_at,rejected_at,approved_at,remarks,division_id,version,feedback,is_supervisor` +
        `&limit=-1&sort=transaction_date`
      );

      if (!eRes.ok) return json(eRes.data, { status: eRes.status });

      const rawExpenses = getListData<ExpenseDraftRow>(eRes.data);
      const expenses = rawExpenses.filter((expense) => {
        const expenseDivisionId = toNumber(expense.division_id);
        return canAccessScope(rbac, salesmanDeptId, expenseDivisionId || salesmanDivisionId);
      });

      const cRes = await directusFetch(
        `/items/user_expense_ceiling?filter[user_id][_eq]=${employeeId}&limit=1`
      );

      const ceilingRow = getListData<{ expense_limit?: number | string }>(cRes.data)[0];
      const expenseLimit = toNumber(ceilingRow?.expense_limit);

      let resolvedDivisionId = salesmanDivisionId || null;
      let departmentName = "";
      let divisionName = "";

      if (userInfo?.user_department) {
        const dRes = await directusFetch(
          `/items/department?filter[department_id][_eq]=${userInfo.user_department}&fields=department_id,department_name,parent_division&limit=1`
        );

        const dept = getListData<DepartmentRow>(dRes.data)[0];

        if (dept) {
          departmentName = String(dept.department_name ?? "");

          if (dept.parent_division) {
            resolvedDivisionId = toNumber(dept.parent_division);
          }
        }
      }

      if (resolvedDivisionId) {
        const divRes = await directusFetch(
          `/items/division?filter[division_id][_eq]=${resolvedDivisionId}&fields=division_name&limit=1`
        );

        const div = getListData<{ division_name?: string }>(divRes.data)[0];
        if (div) divisionName = String(div.division_name ?? "");
      }

      const coaIds = uniquePositiveNumbers(expenses.map((expense) => expense.particulars));
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

      const enriched: EnrichedExpenseDraftRow[] = expenses.map((expense) => ({
        ...expense,
        particulars_name: coaMap[toNumber(expense.particulars)] ?? "",
      }));

      const headerIds = uniquePositiveNumbers(
        enriched.map((expense) => getRelationId(expense.header_id))
      );

      let headers: FormattedExpenseDraftHeader[] = [];

      if (headerIds.length > 0) {
        const hRes = await directusFetch(
          `/items/expense_draft_header?filter[id][_in]=${headerIds.join(",")}&fields=id,period_from,period_to,remarks,status&limit=-1`
        );

        headers = getListData<ExpenseDraftHeaderRow>(hRes.data).map((header) => ({
          id: toNumber(header.id),
          period_from: String(header.period_from ?? ""),
          period_to: String(header.period_to ?? ""),
          remarks: header.remarks ? String(header.remarks) : null,
          status: String(header.status ?? ""),
        }));
      }

      const fallbackSalesmanName = getUserFullName(userInfo) || `User #${employeeId}`;

      return json({
        salesman: {
          id: salesman?.id ?? employeeId,
          salesman_name: salesman?.salesman_name ?? fallbackSalesmanName,
          salesman_code: salesman?.salesman_code ?? String(employeeId),
          employee_id: employeeId,
          division_id: resolvedDivisionId,
          user: userInfo ?? null,
          department_name: departmentName,
          division_name: divisionName,
        },
        expense_limit: expenseLimit,
        expenses: enriched,
        headers,
      });
    }

    if (resource === "logs") {
      const disbRes = await directusFetch(
        `/items/disbursement_draft?filter[transaction_type][_eq]=2&filter[_or][0][is_supervisor][_neq]=1&filter[_or][1][is_supervisor][_null]=true&sort=-id&limit=200&fields=id,doc_no,status,transaction_date,payee,encoder_id,total_amount,remarks,approver_id,date_created,division_id,is_supervisor`
      );

      if (!disbRes.ok) return json(disbRes.data, { status: disbRes.status });

      const logs = getListData<DisbursementDraftRow>(disbRes.data);
      const uids = new Set<number>();

      for (const log of logs) {
        if (log.payee) uids.add(toNumber(log.payee));
        if (log.encoder_id) uids.add(toNumber(log.encoder_id));
        if (log.approver_id) uids.add(toNumber(log.approver_id));
      }

      const users = await fetchUserMap([...uids]);
      const userMap: Record<number, string> = {};
      const userDeptMap: Record<number, number> = {};

      for (const [id, user] of Object.entries(users)) {
        const userId = toNumber(id);
        userMap[userId] = getUserFullName(user);
        userDeptMap[userId] = toNumber(user.user_department);
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

      const logIds = visibleLogs.map((log) => toNumber(log.id)).filter((id) => id > 0);

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

      const expenseIdsForAudit = uniquePositiveNumbers(
        pRowsForIds.map((payable) => getRelationId(payable.expense_id))
      );

      let allExpenseLogs: ExpenseLogRow[] = [];
      const supervisorExpenseIdsSet = new Set<number>();

      if (expenseIdsForAudit.length > 0) {
        const [finalElRes, expDraftsRes] = await Promise.all([
          directusFetch(
            `/items/expense_draft_logs?filter[expense_id][_in]=${expenseIdsForAudit.join(",")}&fields=log_id,expense_id,action,changed_by,changed_at,amount,remarks,particulars,status,version&limit=-1`
          ),
          directusFetch(
            `/items/expense_draft?filter[id][_in]=${expenseIdsForAudit.join(",")}&fields=id,is_supervisor&limit=-1`
          ),
        ]);

        if (finalElRes.ok) {
          allExpenseLogs = getListData<ExpenseLogRow>(finalElRes.data);
        }

        if (expDraftsRes.ok) {
          const expRows = getListData<{ id: number; is_supervisor?: number | string | null }>(expDraftsRes.data);
          for (const row of expRows) {
            if (Number(row.is_supervisor) === 1) {
              supervisorExpenseIdsSet.add(toNumber(row.id));
            }
          }
        }
      }

      const voteUids = uniquePositiveNumbers([
        ...allVotes.map((vote) => vote.approver_id),
        ...allDraftLogs.map((log) => log.updated_by),
        ...allExpenseLogs.map((log) => log.changed_by),
      ]);

      const missingUids = voteUids.filter((uid) => !userMap[uid]);

      if (missingUids.length > 0) {
        const moreUsers = await fetchUserMap(missingUids);

        for (const [id, user] of Object.entries(moreUsers)) {
          userMap[toNumber(id)] = getUserFullName(user);
        }
      }

      const coaIdsForLogs = uniquePositiveNumbers(
        allExpenseLogs.map((log) => log.particulars)
      );

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

      const formattedLogs = visibleLogs
        .map((log) => {
          const logId = toNumber(log.id);

          const currentExpenseIds = pRowsForIds
            .filter((payable) => getRelationId(payable.disbursement_id) === logId)
            .map((payable) => getRelationId(payable.expense_id))
            .filter((id) => id > 0);

          const hasSupervisorExpense = currentExpenseIds.some((expId) => supervisorExpenseIdsSet.has(expId));
          if (hasSupervisorExpense) return null;

          const logVotes = allVotes
            .filter((vote) => toNumber(vote.draft_id) === logId)
            .map((vote) => ({
              approver_name: userMap[toNumber(vote.approver_id)] || `User #${vote.approver_id}`,
              status: String(vote.status ?? ""),
              remarks: vote.remarks ? String(vote.remarks) : null,
              version: toNumber(vote.version, 1),
              created_at: String(vote.created_at ?? ""),
            }));

          const draftLogs = allDraftLogs
            .filter((draftLog) => toNumber(draftLog.disbursement_id) === logId)
            .map((draftLog) => {
              let snapshot: { old_total?: number; new_total?: number } = {};

              try {
                snapshot = JSON.parse(String(draftLog.payload_snapshot || "{}")) as {
                  old_total?: number;
                  new_total?: number;
                };
              } catch {
                snapshot = {};
              }

              return {
                id: toNumber(draftLog.id),
                editor_name:
                  userMap[toNumber(draftLog.updated_by)] || `User #${draftLog.updated_by}`,
                edit_reason: String(draftLog.edit_reason || ""),
                old_total: toNumber(snapshot.old_total),
                new_total: toNumber(snapshot.new_total),
                created_at: String(draftLog.log_date || ""),
              };
            });

          const expenseLogs = allExpenseLogs
            .filter((expenseLog) => {
              const expId = toNumber(expenseLog.expense_id);
              return currentExpenseIds.includes(expId) && !supervisorExpenseIdsSet.has(expId);
            })
            .map((expenseLog) => ({
              log_id: toNumber(expenseLog.log_id),
              expense_id: toNumber(expenseLog.expense_id),
              action: String(expenseLog.action || ""),
              editor_name:
                userMap[toNumber(expenseLog.changed_by)] || `User #${expenseLog.changed_by}`,
              changed_at: String(expenseLog.changed_at || ""),
              amount: toNumber(expenseLog.amount),
              remarks: expenseLog.remarks ? String(expenseLog.remarks) : null,
              particulars:
                coaMapForLogs[toNumber(expenseLog.particulars)] ||
                String(expenseLog.particulars || ""),
              status: String(expenseLog.status || ""),
              version: toNumber(expenseLog.version, 1),
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
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

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
      const coaIds = uniquePositiveNumbers(payables.map((payable) => payable.coa_id));
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

      const formattedPayables = payables.map((payable) => ({
        id: payable.id,
        coa_name: coaMap[toNumber(payable.coa_id)] || `COA #${payable.coa_id}`,
        amount: payable.amount,
        remarks: payable.remarks,
        date: payable.date,
      }));

      return json({ data: formattedPayables });
    }

    let expFilterBase =
      `/items/expense_draft?filter[status][_in]=${directusIn(PENDING_EXPENSE_STATUSES)}`;

    expFilterBase = withDateFilters(expFilterBase, startDate, endDate);

    const allExpRes = await directusFetch(
      `${expFilterBase}&fields=id,header_id,encoded_by,division_id,status,transaction_date,amount,approved_at,is_supervisor&limit=-1`
    );

    if (!allExpRes.ok) {
      return json(allExpRes.data, { status: allExpRes.status });
    }

    const rawExpenses = getListData<ExpenseDraftRow>(allExpRes.data);
    const encodedByIds = uniquePositiveNumbers(rawExpenses.map((expense) => expense.encoded_by));
    const userMap = await fetchUserMap(encodedByIds);

    const allExpenses = rawExpenses.filter((expense) => {
      if (Number(expense.is_supervisor) === 1) return false;

      const encoderId = toNumber(expense.encoded_by);
      const encoderDepartmentId = toNumber(userMap[encoderId]?.user_department);
      const expenseDivisionId = toNumber(expense.division_id);

      return canAccessScope(rbac, encoderDepartmentId, expenseDivisionId);
    });

    if (allExpenses.length === 0) {
      return json({ data: [] });
    }

    const visibleEncodedByIds = uniquePositiveNumbers(
      allExpenses.map((expense) => expense.encoded_by)
    );
    const salesmanMap = await fetchSalesmenByEmployeeIds(visibleEncodedByIds);

    const countMap: Record<string, CountBucket> = {};

    for (const expense of allExpenses) {
      const encodedBy = toNumber(expense.encoded_by);
      const divisionId = toNumber(expense.division_id);
      const key = `${encodedBy}_${divisionId}`;

      if (!countMap[key]) {
        countMap[key] = {
          draft: 0,
          rejected: 0,
          concern: 0,
          amount: 0,
          headers: new Set<number>(),
        };
      }

      if (expense.status === "Drafts") {
        countMap[key].draft += 1;
      } else if (expense.status === "With Concern") {
        countMap[key].concern += 1;
      } else if (expense.status === "Rejected") {
        countMap[key].rejected += 1;
      }

      countMap[key].amount += toNumber(expense.amount);

      const headerId = getRelationId(expense.header_id);
      if (headerId > 0) countMap[key].headers.add(headerId);
    }

    const divisionIds = uniquePositiveNumbers([
      ...allExpenses.map((expense) => expense.division_id),
      ...Object.values(salesmanMap).map((salesman) => salesman.division_id),
    ]);

    const divisionNameMap = await fetchDivisionNameMap(divisionIds);

    const result: SalesmanSummaryRow[] = Object.entries(countMap)
      .map(([key, bucket]) => {
        const [encodedByRaw, divisionRaw] = key.split("_");
        const employeeId = toNumber(encodedByRaw);
        const expenseDivisionId = toNumber(divisionRaw);
        const salesman = salesmanMap[employeeId];
        const user = userMap[employeeId];
        const salesmanDivisionId = toNumber(salesman?.division_id);
        const finalDivisionId = expenseDivisionId || salesmanDivisionId || null;
        const fallbackName = getUserFullName(user) || `User #${employeeId}`;

        return {
          id: salesman?.id ?? employeeId,
          salesman_name: String(salesman?.salesman_name ?? fallbackName),
          salesman_code: salesman?.salesman_code ? String(salesman.salesman_code) : String(employeeId),
          employee_id: employeeId,
          division_id: finalDivisionId,
          division_name: finalDivisionId ? divisionNameMap[finalDivisionId] ?? null : null,
          draft_count: bucket.draft,
          rejected_count: bucket.rejected,
          concern_count: bucket.concern,
          pending_amount: bucket.amount,
          header_count: bucket.headers.size,
        };
      })
      .sort((a, b) => a.salesman_name.localeCompare(b.salesman_name));

    return json({ data: result });
  } catch (error: unknown) {
    return json(
      {
        error: "Server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    type RawDecisionStatus =
      | "Approved"
      | "Rejected"
      | "With Concern"
      | "WITH_CONCERN"
      | "WithConcern"
      | "with_concern"
      | "approved"
      | "rejected";

    type NormalizedDecisionStatus = "Approved" | "Rejected" | "With Concern";

    type ItemDecision = {
      status: RawDecisionStatus;
      remarks: string;
    };

    type EditedAmountInput = {
      id: number;
      amount: number;
    };

    type PostBody = {
      item_decisions: Record<string, ItemDecision>;
      remarks?: string;
      salesman_id: number;
      all_ids?: number[];
      salesman_user_id?: number;
      edited_amounts?: EditedAmountInput[] | Record<string, number>;
    };

    type DirectusListResponse<T> = {
      data?: T[];
    };

    type DirectusItemResponse<T> = {
      data?: T;
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
      is_supervisor?: number | string | null;
    };

    type SalesmanRow = {
      id: number;
      division_id?: number | string | null;
      employee_id?: number | string | null;
    };

    type UserRow = {
      user_id?: number | string | null;
      user_department?: number | string | null;
    };

    type PayableDraftRow = {
      id?: number | string;
      disbursement_id?: number | string | { id?: number | string } | null;
      expense_id?: number | string | { id?: number | string } | null;
    };

    type DisbursementDraftRow = {
      id?: number | string;
      doc_no?: string | null;
      approval_version?: number | string | null;
      total_amount?: number | string | null;
    };

    function toNumber(value: unknown, fallback = 0): number {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }

    function getListData<T>(payload: unknown): T[] {
      return ((payload as DirectusListResponse<T>)?.data ?? []) as T[];
    }

    function getItemData<T>(payload: unknown): T | undefined {
      return (payload as DirectusItemResponse<T>)?.data;
    }

    function getRelationId(value: unknown): number {
      if (typeof value === "object" && value !== null && "id" in value) {
        return toNumber((value as { id?: unknown }).id);
      }

      return toNumber(value);
    }

    function normalizeDecisionStatus(
      status: RawDecisionStatus
    ): NormalizedDecisionStatus {
      const normalized = String(status).trim().toLowerCase();

      if (normalized === "approved") return "Approved";
      if (normalized === "rejected") return "Rejected";

      if (
        normalized === "with concern" ||
        normalized === "with_concern" ||
        normalized === "withconcern"
      ) {
        return "With Concern";
      }

      throw new Error(`Invalid decision status: ${String(status)}`);
    }

    function makeExpenseDecisionPatch(
      status: NormalizedDecisionStatus,
      feedback: string | null,
      nowTs: string
    ): Record<string, unknown> {
      const patch: Record<string, unknown> = {
        status,
        feedback: status !== "Approved" ? feedback : null,
      };

      if (status === "Approved") {
        patch.approved_at = nowTs;
        patch.rejected_at = null;
      }

      if (status === "Rejected") {
        patch.rejected_at = nowTs;
        patch.approved_at = null;
      }

      if (status === "With Concern") {
        patch.approved_at = null;
        patch.rejected_at = null;
      }

      return patch;
    }

    const body = (await req.json()) as PostBody;

    const {
      item_decisions: rawItemDecisions,
      remarks = "",
      salesman_id: salesmanId,
    } = body;

    let { all_ids: allIds, salesman_user_id: salesmanUserId } = body;
    const { edited_amounts } = body;

    if (!rawItemDecisions || Object.keys(rawItemDecisions).length === 0) {
      return json({ error: "No decisions provided" }, { status: 400 });
    }

    const itemDecisions: Record<
      string,
      { status: NormalizedDecisionStatus; remarks: string }
    > = {};

    for (const [id, decision] of Object.entries(rawItemDecisions)) {
      itemDecisions[id] = {
        status: normalizeDecisionStatus(decision.status),
        remarks: decision.remarks ?? "",
      };
    }

    if (!allIds || allIds.length === 0) {
      allIds = Object.keys(itemDecisions)
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
    }

    const selectedIds = Object.entries(itemDecisions)
      .filter(([, decision]) => decision.status === "Approved")
      .map(([id]) => Number(id))
      .filter((id) => Number.isFinite(id));

    let salesmanDivisionId: number | null = null;
    let salesmanDepartmentId: number | null = null;

    const sRes = await directusFetch(
      `/items/salesman?filter[id][_eq]=${salesmanId}&fields=id,division_id,employee_id&limit=1`
    );

    if (!sRes.ok) {
      return json(sRes.data, { status: sRes.status });
    }

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

    if (!uRes.ok) {
      return json(uRes.data, { status: uRes.status });
    }

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
      `&filter[status][_in]=Approved,Drafts,Rejected,With Concern` +
      `&fields=id,header_id,encoded_by,particulars,amount,transaction_date,attachment_url,remarks,division_id,payee,payee_id,status,version,feedback,approved_at,rejected_at,is_supervisor&limit=-1`
    );

    if (!eRes.ok) {
      return json(eRes.data, { status: eRes.status });
    }

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

        const original = allDetailRows.find((expense) => toNumber(expense.id) === id);

        if (!original) continue;

        const decision = itemDecisions[String(id)];
        const finalStatus = decision?.status || original.status || "Drafts";
        const newVersion = toNumber(original.version, 1) + 1;

        const logRes = await directusFetch(`/items/expense_draft_logs`, {
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

        if (!logRes.ok) {
          return json(
            {
              error: "Failed to create expense audit log",
              details: logRes.data,
            },
            { status: logRes.status }
          );
        }

        const updateObj: Record<string, unknown> = {
          amount: newAmount,
          version: newVersion,
        };

        if (decision) {
          Object.assign(
            updateObj,
            makeExpenseDecisionPatch(decision.status, decision.remarks, nowTs)
          );
        }

        const patchRes = await directusFetch(`/items/expense_draft/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(updateObj),
        });

        if (!patchRes.ok) {
          return json(
            {
              error: "Failed to update expense draft",
              expense_id: id,
              attempted_update: updateObj,
              details: patchRes.data,
            },
            { status: patchRes.status }
          );
        }

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
      const original = allDetailRows.find((expense) => toNumber(expense.id) === id);

      if (!decision || !original) continue;

      const updateData = makeExpenseDecisionPatch(
        decision.status,
        decision.remarks,
        nowTs
      );

      const patchRes = await directusFetch(`/items/expense_draft/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!patchRes.ok) {
        return json(
          {
            error: "Failed to update expense draft decision",
            expense_id: id,
            attempted_update: updateData,
            details: patchRes.data,
          },
          { status: patchRes.status }
        );
      }

      original.status = decision.status;
      original.feedback = decision.status !== "Approved" ? decision.remarks : null;
      original.approved_at = decision.status === "Approved" ? nowTs : null;
      original.rejected_at = decision.status === "Rejected" ? nowTs : null;
    }

    const selectedExpenses = allDetailRows.filter((row) => {
      const decision = itemDecisions[String(row.id)];

      if (decision) {
        return decision.status === "Approved";
      }

      return row.status === "Approved";
    });

    if (selectedExpenses.length === 0) {
      return json({
        ok: true,
        disbursement_id: null,
        message: "Items updated. No approved expenses to consolidate.",
      });
    }

    let disbursementId: number | null = null;
    let docNo: string | null = null;
    let approvalVersion = 1;

    if (selectedIds.length > 0) {
      const existingPayRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[expense_id][_in]=${selectedIds.join(
          ","
        )}&fields=disbursement_id&limit=1`
      );

      if (!existingPayRes.ok) {
        return json(existingPayRes.data, { status: existingPayRes.status });
      }

      const existingPayRows = getListData<PayableDraftRow>(existingPayRes.data);

      if (existingPayRows.length > 0) {
        const existingDisbursementId = getRelationId(
          existingPayRows[0].disbursement_id
        );

        if (existingDisbursementId > 0) {
          const dRes = await directusFetch(
            `/items/disbursement_draft/${existingDisbursementId}?fields=id,doc_no,approval_version,total_amount`
          );

          if (!dRes.ok) {
            return json(dRes.data, { status: dRes.status });
          }

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
      (sum, expense) => sum + toNumber(expense.amount),
      0
    );

    const supportingDocs = selectedExpenses
      .filter((expense) => expense.attachment_url)
      .map((expense) => expense.attachment_url)
      .join(",");

    const hasSupervisor = allDetailRows.some((e) => Number(e.is_supervisor) === 1);

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
            is_supervisor: hasSupervisor ? 1 : 0,
          }),
        }
      );

      if (!updateDisbRes.ok) {
        return json(updateDisbRes.data, { status: updateDisbRes.status });
      }

      const oldPayRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${disbursementId}&fields=id&limit=-1`
      );

      if (!oldPayRes.ok) {
        return json(oldPayRes.data, { status: oldPayRes.status });
      }

      const oldPayIds = getListData<{ id?: number | string }>(oldPayRes.data)
        .map((payable) => toNumber(payable.id))
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

      if (!latestRes.ok) {
        return json(latestRes.data, { status: latestRes.status });
      }

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
          is_supervisor: hasSupervisor ? 1 : 0,
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

    const payables = selectedExpenses.map((expense) => ({
      disbursement_id: disbursementId,
      expense_id: toNumber(expense.id),
      division_id: salesmanDivisionId,
      reference_no: docNo,
      date: expense.transaction_date,
      coa_id: toNumber(expense.particulars),
      amount: toNumber(expense.amount),
      remarks: expense.remarks || null,
      version: toNumber(expense.version, 1),
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
  } catch (error: unknown) {
    return json(
      {
        error: "Server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}