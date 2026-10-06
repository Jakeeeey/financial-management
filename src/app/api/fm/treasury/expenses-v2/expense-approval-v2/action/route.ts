import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtDecode } from "jwt-decode";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

async function getUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return null;
  try {
    const decoded = jwtDecode(token) as { sub?: string };
    return decoded.sub ? parseInt(decoded.sub, 10) : null;
  } catch {
    return null;
  }
}

async function getNonTradeTransactionTypeId(): Promise<number> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/items/transaction_type?filter[transaction_type][_eq]=Non-Trade&fields=id`,
      { headers: AUTH_HEADERS, cache: "no-store" }
    );
    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        return json.data[0].id;
      }
    }
  } catch {}
  return 2; // Fallback ID for Non-Trade
}

function getLiteralPhTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface ExpenseRecord {
  id: number;
  doc_no?: string;
  expense_date?: string;
  payee?: number;
  is_employee?: boolean | number;
  division_id?: number | null;
  department_id?: number | null;
  coa_id?: number | null;
  amount?: number;
  remarks?: string | null;
  receipt_url?: string | null;
  status?: string;
  current_approval_level?: number;
  is_final_approved?: boolean | number;
  created_by?: number | { user_id?: number } | null;
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { expense_id, expense_ids, action, remarks, created_at } = body;

    // Normalize IDs input into an array
    const targetIds: number[] = Array.isArray(expense_ids) && expense_ids.length > 0
      ? expense_ids
      : expense_id
      ? [Number(expense_id)]
      : [];

    if (targetIds.length === 0 || !action) {
      return NextResponse.json(
        { error: "Expense ID(s) and action are required." },
        { status: 400 }
      );
    }

    const currentTimestamp = created_at || getLiteralPhTimestamp();

    // Fetch details for all requested expense items
    const fetchedExpenses: ExpenseRecord[] = [];
    for (const id of targetIds) {
      const expRes = await fetch(`${API_BASE_URL}/items/expense/${id}`, {
        headers: AUTH_HEADERS,
        cache: "no-store",
      });
      if (expRes.ok) {
        const expJson = await expRes.json();
        if (expJson.data) {
          fetchedExpenses.push(expJson.data as ExpenseRecord);
        }
      }
    }

    if (fetchedExpenses.length === 0) {
      return NextResponse.json({ error: "No valid expense records found." }, { status: 404 });
    }

    if (action === "Approve") {
      // 1. Authorization check and tier level calculation per item
      const finalApprovedItems: ExpenseRecord[] = [];
      const intermediateItems: ExpenseRecord[] = [];

      for (const item of fetchedExpenses) {
        if (item.status === "Submitted To Disbursement") {
          continue; // Skip already finalized items
        }

        const divisionId = item.division_id;
        let maxLevel = 1;
        let isUserAuthorized = false;

        if (divisionId) {
          const approversRes = await fetch(
            `${API_BASE_URL}/items/expense_approvers?filter[division_id][_eq]=${divisionId}&filter[is_deleted][_eq]=false`,
            { headers: AUTH_HEADERS, cache: "no-store" }
          );

          if (approversRes.ok) {
            const appJson = await approversRes.json();
            const approversList = appJson.data || [];
            if (approversList.length > 0) {
              maxLevel = Math.max(
                ...approversList.map((a: { approver_hierarchy?: number }) => Number(a.approver_hierarchy || 1))
              );

              isUserAuthorized = approversList.some(
                (a: { approver_id?: { user_id: number } | number; approver_hierarchy?: number }) => {
                  const appUserId =
                    typeof a.approver_id === "object" && a.approver_id !== null
                      ? a.approver_id.user_id
                      : Number(a.approver_id);
                  return (
                    Number(appUserId) === Number(userId) &&
                    Number(a.approver_hierarchy) === Number(item.current_approval_level || 1)
                  );
                }
              );
            }
          }
        }

        // Strict Authorization Enforcement
        if (!isUserAuthorized && userId) {
          return NextResponse.json(
            {
              error: `Unauthorized: You are not assigned to approve Tier ${item.current_approval_level || 1} for item ${item.doc_no || item.id}.`,
            },
            { status: 403 }
          );
        }

        const currentLevel = Number(item.current_approval_level || 1);
        if (currentLevel >= maxLevel) {
          finalApprovedItems.push(item);
        } else {
          intermediateItems.push(item);
        }
      }

      const createdDisbursementIds: number[] = [];

      // 2. Process Final Approved Items with Auto-Grouping by Payee & Entity
      if (finalApprovedItems.length > 0) {
        const nonTradeTypeId = await getNonTradeTransactionTypeId();

        // Group final approved items by payee + is_employee + division_id to ensure strict accounting integrity
        const payeeGroupsMap = new Map<string, ExpenseRecord[]>();
        for (const item of finalApprovedItems) {
          const groupKey = `${item.payee || 0}_${item.is_employee ? 1 : 0}_${item.division_id || 0}`;
          if (!payeeGroupsMap.has(groupKey)) {
            payeeGroupsMap.set(groupKey, []);
          }
          payeeGroupsMap.get(groupKey)!.push(item);
        }

        let groupIndex = 0;
        for (const [, groupItems] of payeeGroupsMap.entries()) {
          groupIndex += 1;
          const firstItem = groupItems[0];
          const totalGroupAmount = groupItems.reduce(
            (sum, i) => sum + Number(i.amount || 0),
            0
          );

          let resolvedEncoderId = userId || 0;
          const rawCreatedBy = firstItem.created_by;
          if (typeof rawCreatedBy === "object" && rawCreatedBy !== null && rawCreatedBy.user_id) {
            resolvedEncoderId = Number(rawCreatedBy.user_id);
          } else if (typeof rawCreatedBy === "number" && rawCreatedBy > 0) {
            resolvedEncoderId = rawCreatedBy;
          }

          // Generate unique and clear document number
          const headerDocNo = groupItems.length === 1
            ? `DSB-${firstItem.doc_no || firstItem.id}`
            : `DSB-EXP-BATCH-${Date.now().toString(36).toUpperCase()}${groupIndex > 1 ? `-${groupIndex}` : ""}`;

          const dsbPayload = {
            doc_no: headerDocNo,
            transaction_type: nonTradeTypeId,
            payee: Number(firstItem.payee || 0),
            is_employee: firstItem.is_employee ? 1 : 0,
            remarks: groupItems.length > 1
              ? `Batch Expense Approval (${groupItems.length} items)`
              : "From Expense",
            total_amount: totalGroupAmount,
            paid_amount: 0,
            encoder_id: resolvedEncoderId,
            submitted_by: userId,
            approver_id: userId,
            division_id: firstItem.division_id || null,
            department_id: firstItem.department_id || null,
            supporting_documents_url: firstItem.receipt_url
              ? firstItem.receipt_url.startsWith("http")
                ? firstItem.receipt_url
                : `${API_BASE_URL}/assets/${firstItem.receipt_url}`
              : null,
            status: "Submitted",
            source_type: "EXPENSE_V2",
            source_reference_id: Number(firstItem.id),
            date_submitted: null,
            date_approved: null,
          };

          const dsbRes = await fetch(`${API_BASE_URL}/items/disbursement`, {
            method: "POST",
            headers: AUTH_HEADERS,
            body: JSON.stringify(dsbPayload),
          });

          if (!dsbRes.ok) {
            const dsbErr = await dsbRes.text();
            return NextResponse.json(
              { error: `Failed to create disbursement header: ${dsbErr}` },
              { status: dsbRes.status }
            );
          }

          const dsbJson = await dsbRes.json();
          const disbursementId = dsbJson.data?.id || null;
          if (disbursementId) {
            createdDisbursementIds.push(disbursementId);
          }

          // Create individual Payable Line Items under this Disbursement Header
          for (const item of groupItems) {
            const payablePayload = {
              disbursement_id: disbursementId,
              division_id: item.division_id || null,
              reference_no: item.doc_no || `EXP-${item.id}`,
              date: item.expense_date || new Date().toISOString().split("T")[0],
              coa_id: item.coa_id || null,
              amount: Number(item.amount || 0),
              remarks: item.remarks || "From Expense",
            };

            let payableId: number | null = null;
            const payableRes = await fetch(`${API_BASE_URL}/items/disbursement_payables`, {
              method: "POST",
              headers: AUTH_HEADERS,
              body: JSON.stringify(payablePayload),
            });

            if (payableRes.ok) {
              const payableJson = await payableRes.json();
              payableId = payableJson.data?.id || null;
            }

            // Patch expense item status & linking fields
            await fetch(`${API_BASE_URL}/items/expense/${item.id}`, {
              method: "PATCH",
              headers: AUTH_HEADERS,
              body: JSON.stringify({
                status: "Submitted To Disbursement",
                is_final_approved: 1,
                disbursement_id: disbursementId,
                disbursement_payable_id: payableId,
                updated_at: currentTimestamp,
              }),
            });

            // Insert audit history log
            await fetch(`${API_BASE_URL}/items/expense_logs`, {
              method: "POST",
              headers: AUTH_HEADERS,
              body: JSON.stringify({
                expense_id: Number(item.id),
                action: "Approved To Disbursement",
                remarks: remarks || null,
                receipt_url: item.receipt_url || null,
                created_by: userId,
                created_at: currentTimestamp,
              }),
            });
          }
        }
      }

      // 3. Process Intermediate Tier Items
      for (const item of intermediateItems) {
        const nextLevel = Number(item.current_approval_level || 1) + 1;
        await fetch(`${API_BASE_URL}/items/expense/${item.id}`, {
          method: "PATCH",
          headers: AUTH_HEADERS,
          body: JSON.stringify({
            status: "Pending Approval",
            current_approval_level: nextLevel,
            updated_at: currentTimestamp,
          }),
        });

        await fetch(`${API_BASE_URL}/items/expense_logs`, {
          method: "POST",
          headers: AUTH_HEADERS,
          body: JSON.stringify({
            expense_id: Number(item.id),
            action: "Approved",
            remarks: remarks || null,
            receipt_url: item.receipt_url || null,
            created_by: userId,
            created_at: currentTimestamp,
          }),
        });
      }

      return NextResponse.json({
        success: true,
        disbursement_ids: createdDisbursementIds,
        processed_count: fetchedExpenses.length,
      });
    }

    // Handle "With Concern" or "Reject" actions
    const nextStatus = action === "With Concern" ? "With Concern" : "Rejected";
    const logAction = action === "With Concern" ? "With Concern" : "Rejected";

    for (const item of fetchedExpenses) {
      await fetch(`${API_BASE_URL}/items/expense/${item.id}`, {
        method: "PATCH",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          status: nextStatus,
          updated_at: currentTimestamp,
        }),
      });

      await fetch(`${API_BASE_URL}/items/expense_logs`, {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          expense_id: Number(item.id),
          action: logAction,
          remarks: remarks || null,
          receipt_url: item.receipt_url || null,
          created_by: userId,
          created_at: currentTimestamp,
        }),
      });
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      processed_count: fetchedExpenses.length,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
