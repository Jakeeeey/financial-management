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

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { expense_id, action, remarks, created_at } = body;

    if (!expense_id || !action) {
      return NextResponse.json(
        { error: "Expense ID and action are required." },
        { status: 400 }
      );
    }

    const currentTimestamp = created_at || getLiteralPhTimestamp();

    // Fetch existing expense item details
    const expRes = await fetch(`${API_BASE_URL}/items/expense/${expense_id}`, {
      headers: AUTH_HEADERS,
      cache: "no-store",
    });

    if (!expRes.ok) {
      return NextResponse.json({ error: "Expense record not found." }, { status: 404 });
    }

    const expJson = await expRes.json();
    const currentExpense = expJson.data;

    let nextStatus = "Pending Approval";
    let nextLevel = Number(currentExpense.current_approval_level || 1);
    let logAction = "";

    let disbursementId: number | null = null;
    let payableId: number | null = null;

    if (action === "Approve") {
      // 1. Fetch active approvers for this division to determine max hierarchy level
      const divisionId = currentExpense.division_id;
      let maxLevel = 1;

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
          }
        }
      }

      const isFinalTier = nextLevel >= maxLevel;

      if (isFinalTier) {
        // FINAL APPROVAL TIER PIPELINE

        // Resolve Non-Trade Transaction Type ID
        const nonTradeTypeId = await getNonTradeTransactionTypeId();

        // Step 1: Create disbursement header record
        const dsbPayload = {
          doc_no: `DSB-${currentExpense.doc_no || currentExpense.id}`,
          transaction_type: nonTradeTypeId,
          payee: Number(currentExpense.payee || 0),
          is_employee: currentExpense.is_employee ? 1 : 0,
          remarks: "From Expense",
          total_amount: Number(currentExpense.amount || 0),
          paid_amount: 0,
          encoder_id:
            typeof currentExpense.created_by === "object" && currentExpense.created_by !== null
              ? Number(currentExpense.created_by.user_id)
              : Number(currentExpense.created_by || userId || 0),
          submitted_by: userId,
          approver_id: userId,
          division_id: currentExpense.division_id || null,
          department_id: currentExpense.department_id || null,
          supporting_documents_url: currentExpense.receipt_url || null,
          status: "Submitted",
          source_type: "EXPENSE_V2",
          source_reference_id: Number(expense_id),
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
            { error: `Failed to create disbursement record: ${dsbErr}` },
            { status: dsbRes.status }
          );
        }

        const dsbJson = await dsbRes.json();
        disbursementId = dsbJson.data?.id || null;

        // Step 2: Create disbursement_payables line item record
        const payablePayload = {
          disbursement_id: disbursementId,
          division_id: currentExpense.division_id || null,
          reference_no: currentExpense.doc_no || `EXP-${expense_id}`,
          date: currentExpense.expense_date || new Date().toISOString().split("T")[0],
          coa_id: currentExpense.coa_id || null,
          amount: Number(currentExpense.amount || 0),
          remarks: currentExpense.remarks || "From Expense",
        };

        const payableRes = await fetch(`${API_BASE_URL}/items/disbursement_payables`, {
          method: "POST",
          headers: AUTH_HEADERS,
          body: JSON.stringify(payablePayload),
        });

        if (!payableRes.ok) {
          const payableErr = await payableRes.text();
          return NextResponse.json(
            { error: `Failed to create disbursement payable record: ${payableErr}` },
            { status: payableRes.status }
          );
        }

        const payableJson = await payableRes.json();
        payableId = payableJson.data?.id || null;

        // Step 3: Set status & flags for final approved expense
        nextStatus = "Submitted To Disbursement";
        logAction = "Approved To Disbursement";
      } else {
        // INTERMEDIATE APPROVAL TIER PIPELINE
        nextStatus = "Pending Approval";
        nextLevel = nextLevel + 1;
        logAction = "Approved";
      }
    } else if (action === "With Concern") {
      nextStatus = "With Concern";
      logAction = "With Concern";
    } else if (action === "Reject") {
      nextStatus = "Rejected";
      logAction = "Rejected";
    }

    // Step 3 (Expense Patch): Update expense item status, flags & IDs
    const expensePatchPayload: Record<string, string | number | boolean | null> = {
      status: nextStatus,
      current_approval_level: nextLevel,
      update_at: currentTimestamp,
    };

    if (nextStatus === "Submitted To Disbursement") {
      expensePatchPayload.is_final_approved = 1;
      expensePatchPayload.disbursement_id = disbursementId;
      expensePatchPayload.disbursement_payable_id = payableId;
    }

    const updateRes = await fetch(`${API_BASE_URL}/items/expense/${expense_id}`, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify(expensePatchPayload),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return NextResponse.json({ error: errText }, { status: updateRes.status });
    }

    // Step 4 (Audit Log): Write audit trail log in expense_logs table
    const logPayload = {
      expense_id: Number(expense_id),
      action: logAction,
      remarks: remarks || null,
      receipt_url: currentExpense.receipt_url || null,
      created_by: userId,
      created_at: currentTimestamp,
    };

    const logRes = await fetch(`${API_BASE_URL}/items/expense_logs`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(logPayload),
    });

    if (!logRes.ok) {
      const logErr = await logRes.text();
      console.error("Failed to insert expense_log entry:", logErr);
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      next_level: nextLevel,
      disbursement_id: disbursementId,
      disbursement_payable_id: payableId,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
