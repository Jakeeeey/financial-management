import { NextRequest, NextResponse } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import {
  getPlanFinancialContext,
  resolveDriverSupplier,
} from "../_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function springDetail(id: number): Promise<Response> {
  const singularResponse = await proxySpring(`/api/v1/dispatch-approval/${encodeURIComponent(String(id))}`);
  if (singularResponse.status !== 404) return singularResponse;

  // The current Spring deployment exposes the legacy plural resource. Keep the
  // requested singular resource as the primary contract, but support that
  // deployed route until the backend is migrated.
  return proxySpring(`/api/v1/dispatch-approvals/${encodeURIComponent(String(id))}`);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string }> },
) {
  const { dispatchPlanId } = await params;
  const id = Number(dispatchPlanId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: "dispatchPlanId must be a positive integer." }, { status: 400 });
  }

  const springResponse = await springDetail(id);
  if (!springResponse.ok) return springResponse;
  const springPayload = await springResponse.json().catch(() => ({})) as Record<string, unknown>;

  // Merge Logistics WER reservations with the budget lines supplied by Spring.
  let context: Awaited<ReturnType<typeof getPlanFinancialContext>>;
  try {
    context = await getPlanFinancialContext(id, true, springPayload.budgets);
  } catch (mergeError) {
    console.error("[Logistics WER] Failed to merge payables context:", mergeError);
    return NextResponse.json({
      ...springPayload,
      werPayables: {
        budgetContextAvailable: false,
        budgetContextError: mergeError instanceof Error ? mergeError.message : "Unable to verify expense budget context.",
        dispatchPlanValue: typeof springPayload.amount === "number" ? springPayload.amount : null,
        reservedAmount: null,
        remainingAmount: null,
        allocatedExpenseBudget: null,
        unclassifiedBudgetAmount: null,
        unclassifiedReservedAmount: null,
        overBudgetAmount: null,
        budgetBalancesByCoa: [],
        isLiquidated: false,
        supplierEligibility: null,
        submissions: [],
      },
    });
  }

  const eligibility = await resolveDriverSupplier(context.plan?.driverId ?? null)
    .catch((eligibilityError: unknown) => ({
      eligible: false,
      driverId: context.plan?.driverId ?? null,
      supplierId: null,
      supplierName: null,
      reason: eligibilityError instanceof Error ? eligibilityError.message : "Supplier eligibility could not be resolved.",
    }));
  return NextResponse.json({
    ...springPayload,
    werPayables: {
      budgetContextAvailable: true,
      dispatchPlanValue: context.baseline,
      reservedAmount: context.reserved,
      remainingAmount: context.remaining,
      allocatedExpenseBudget: context.allocatedBudget,
      unclassifiedBudgetAmount: context.unclassifiedBudgetAmount,
      unclassifiedReservedAmount: context.unclassifiedReservedAmount,
      overBudgetAmount: context.overBudgetAmount,
      budgetBalancesByCoa: context.budgetBalancesByCoa,
      isLiquidated: context.plan?.isLiquidated ?? false,
      supplierEligibility: eligibility,
      submissions: context.submissions,
    },
  });
}
