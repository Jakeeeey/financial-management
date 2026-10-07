import { NextRequest, NextResponse } from "next/server";
import { getPlanBaseline, requireSessionUserId } from "../../../_payables";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status });
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
    const plan = await getPlanBaseline(planId);
    if (!plan) return error("Dispatch plan not found.", 404);
    if ((plan.status || "").toLowerCase() !== "for clearance") {
      return error("Budget lines can only be classified while the plan is in For Clearance state.", 409);
    }
    if (plan.isLiquidated) {
      return error("Liquidated dispatch plans are read-only.", 409);
    }

    return proxySpring(`/api/v1/dispatch-approvals/${planId}/budgets/${lineId}`, {
      method: "PATCH",
      body: JSON.stringify({ coaId, remarks }),
    });
  } catch (requestError) {
    console.error("[Logistics WER] Budget classification failed:", requestError);
    return error(requestError instanceof Error ? requestError.message : "Unable to classify the budget line.", 502);
  }
}
