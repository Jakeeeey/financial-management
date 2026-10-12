import { NextRequest, NextResponse } from "next/server";
import {
  BudgetContextError,
  getPlanBaseline,
  getPlanBudgetLines,
  getPlanRemaining,
  requireSessionUserId,
  withPlanLock,
} from "../../../_payables";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { findBudgetAllocationOverages } from "@/modules/financial-management/reports/logistics-wer/utils/budget-balances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ message, ...details }, { status });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string; budgetId: string }> },
) {
  const { dispatchPlanId, budgetId } = await params;
  const planId = Number(dispatchPlanId);
  const lineId = Number(budgetId);
  if (!Number.isInteger(planId) || planId <= 0 || !Number.isInteger(lineId) || lineId <= 0) {
    return error("Dispatch plan and budget line IDs must be positive integers.", 400);
  }

  if (!(await requireSessionUserId(request))) {
    return error("Authentication is required to classify budget lines.", 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return error("Request body must be valid JSON.", 400);
  }
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return error("Request body must be a JSON object.", 400);
  }
  const body = rawBody as Record<string, unknown>;

  const coaId = Number(body.coaId);
  const remarks = asTrimmedString(body.remarks);
  if (!Number.isInteger(coaId) || coaId <= 0) {
    return error("Select a valid chart-of-accounts entry.", 400);
  }
  if (!remarks) {
    return error("Remarks are required to classify a budget line.", 400);
  }

  try {
    return await withPlanLock(planId, async () => {
      const plan = await getPlanBaseline(planId);
      if (!plan) return error("Dispatch plan not found.", 404);
      if ((plan.status || "").toLowerCase() !== "for clearance") {
        return error("Budget lines can only be classified while the plan is in For Clearance state.", 409);
      }
      if (plan.isLiquidated) return error("Liquidated dispatch plans are read-only.", 409);

      const [budgetLines, current] = await Promise.all([
        getPlanBudgetLines(planId),
        getPlanRemaining(planId),
      ]);
      const line = budgetLines.find((budgetLine) => budgetLine.id === lineId);
      if (!line) return error("Budget line was not found for this dispatch plan.", 404);

      const proposedByCoa = new Map(
        current.budgetBalancesByCoa.map((balance) => [balance.coaId, balance.allocatedAmount]),
      );
      if (line.classified && line.coaId) {
        proposedByCoa.set(
          line.coaId,
          Math.max(0, Math.round(((proposedByCoa.get(line.coaId) ?? 0) - line.amount) * 100) / 100),
        );
      }
      proposedByCoa.set(
        coaId,
        Math.round(((proposedByCoa.get(coaId) ?? 0) + line.amount) * 100) / 100,
      );
      const overages = findBudgetAllocationOverages(
        Array.from(proposedByCoa, ([nextCoaId, amount]) => ({ coaId: nextCoaId, amount })),
        current.budgetBalancesByCoa,
      );
      if (overages.length > 0) {
        return error("Budget line classification cannot reduce an account allocation below active payable reservations.", 409, { overages });
      }

      return proxySpring(`/api/v1/dispatch-approvals/${planId}/budgets/${lineId}`, {
        method: "PATCH",
        body: JSON.stringify({ coaId, remarks }),
      });
    });
  } catch (requestError) {
    console.error("[Logistics WER] Budget classification failed:", requestError);
    if (requestError instanceof BudgetContextError) {
      return error(`Budget classification was blocked because reservations could not be verified: ${requestError.message}`, 503);
    }
    return error(requestError instanceof Error ? requestError.message : "Unable to classify the budget line.", 502);
  }
}
