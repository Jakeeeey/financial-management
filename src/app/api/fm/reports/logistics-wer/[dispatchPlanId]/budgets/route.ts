import { NextRequest, NextResponse } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import {
  BudgetContextError,
  getPlanBaseline,
  getPlanRemaining,
  requireSessionUserId,
  withPlanLock,
} from "../../_payables";
import { findBudgetAllocationOverages } from "@/modules/financial-management/reports/logistics-wer/utils/budget-balances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BudgetInput {
  coaId: number;
  amount: number;
  remarks: string;
}

function error(message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ message, ...details }, { status });
}

function parseBudgets(value: unknown): { budgets?: BudgetInput[]; error?: string } {
  if (!Array.isArray(value)) return { error: "budgets must be an array." };

  const budgets: BudgetInput[] = [];
  const coaIds = new Set<number>();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: `Budget allocation ${index + 1} must be an object.` };
    }
    const row = item as Record<string, unknown>;
    const coaId = Number(row.coaId);
    const amount = Number(row.amount);
    const remarks = typeof row.remarks === "string" ? row.remarks.trim() : "";
    if (!Number.isInteger(coaId) || coaId <= 0) {
      return { error: `Budget allocation ${index + 1} requires a valid expense account.` };
    }
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      return { error: `Budget allocation ${index + 1} must be greater than zero and use no more than two decimal places.` };
    }
    if (!remarks || remarks.length > 1000) {
      return { error: `Budget allocation ${index + 1} requires a purpose of at most 1000 characters.` };
    }
    if (coaIds.has(coaId)) {
      return { error: "Each chart-of-accounts entry can only have one expense budget allocation per dispatch plan." };
    }
    coaIds.add(coaId);
    budgets.push({ coaId, amount, remarks });
  }
  return { budgets };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string }> },
) {
  const { dispatchPlanId } = await params;
  const planId = Number(dispatchPlanId);
  if (!Number.isInteger(planId) || planId <= 0) {
    return error("dispatchPlanId must be a positive integer.", 400);
  }

  if (!(await requireSessionUserId(request))) {
    return error("Authentication is required to manage expense budgets.", 401);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return error("Request body must be a JSON object.", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return error("Request body must be valid JSON.", 400);
  }

  const parsedBudgets = parseBudgets(body.budgets);
  if (parsedBudgets.error) return error(parsedBudgets.error, 400);
  const budgets = parsedBudgets.budgets ?? [];

  try {
    return await withPlanLock(planId, async () => {
      const plan = await getPlanBaseline(planId);
      if (!plan) return error("Dispatch plan not found.", 404);
      if ((plan.status || "").toLowerCase() !== "for clearance") {
        return error("Expense budgets can only be changed while the plan is in For Clearance state.", 409);
      }
      if (plan.isLiquidated) return error("Liquidated dispatch plans are read-only.", 409);

      const current = await getPlanRemaining(planId);
      const overages = findBudgetAllocationOverages(
        budgets.map(({ coaId, amount }) => ({ coaId, amount })),
        current.budgetBalancesByCoa,
      );
      if (overages.length > 0) {
        return error("Expense budget allocations cannot be reduced below active payable reservations.", 409, { overages });
      }

      return proxySpring(`/api/v1/dispatch-approvals/${planId}/budgets`, {
        method: "PUT",
        body: JSON.stringify({ budgets }),
      });
    });
  } catch (requestError) {
    console.error("[Logistics WER] Expense budget update failed:", requestError);
    if (requestError instanceof BudgetContextError) {
      return error(`Expense budget could not be updated because reservations could not be verified: ${requestError.message}`, 503);
    }
    return error(requestError instanceof Error ? requestError.message : "Unable to update expense budget allocations.", 502);
  }
}
