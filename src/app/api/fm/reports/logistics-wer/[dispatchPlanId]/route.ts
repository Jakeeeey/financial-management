import { WerDependencyError, werFailureResponse } from "../_errors";
import { NextRequest, NextResponse } from "next/server";
import { addBudgetCoaLabels, type CoaLabelRow } from "../_coa-labels";
import { getSpringDispatchPlanDetail } from "../_spring";
import {
  directusFetch,
  getPlanFinancialContext,
  resolveDriverSupplier,
} from "../_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string }> },
) {
  const { dispatchPlanId } = await params;
  const id = Number(dispatchPlanId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: "dispatchPlanId must be a positive integer." }, { status: 400 });
  }

  const springResponse = await getSpringDispatchPlanDetail(id);
  if (!springResponse.ok) return springResponse;
  const springPayload = await springResponse.json().catch((cause: unknown) => cause instanceof WerDependencyError && cause.upstreamStatus === 429 ? cause : ({})) as Record<string, unknown>;

  // Merge Logistics WER reservations with the budget lines supplied by Spring.
  let context: Awaited<ReturnType<typeof getPlanFinancialContext>>;
  try {
    context = await getPlanFinancialContext(id, true, springPayload.budgets);
  } catch (mergeError) {
    if (mergeError instanceof WerDependencyError && mergeError.upstreamStatus === 429) return werFailureResponse(mergeError);
    console.error("[Logistics WER] Failed to merge payables context:", mergeError);
    return NextResponse.json({
      ...springPayload,
      werPayables: {
        budgetContextAvailable: false,
        budgetContextError: "The service is temporarily busy. Existing values could not be refreshed. Please try again later.",
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
    .catch(() => ({
      eligible: false,
      driverId: context.plan?.driverId ?? null,
      supplierId: null,
      supplierName: null,
      reason: "Supplier eligibility could not be resolved.",
    }));
  if (eligibility instanceof WerDependencyError) return werFailureResponse(eligibility);
  // Balances can include accounts introduced by expenses, with no original allocation.
  const coaIds = Array.from(new Set(context.budgetBalancesByCoa.map(balance => balance.coaId)))
    .filter(coaId => Number.isInteger(coaId) && coaId > 0);
  let accounts: CoaLabelRow[] = [];
  if (coaIds.length > 0) {
    try {
      const response = await directusFetch<{ data?: CoaLabelRow[] }>(`/items/chart_of_accounts?${new URLSearchParams({
        "filter[coa_id][_in]": coaIds.join(","),
        fields: "coa_id,gl_code,account_title",
        limit: "-1",
      })}`);
      accounts = response.data ?? [];
    } catch (labelError) {
      // A display lookup must not discard already verified financial balances.
      console.warn("[Logistics WER] Account labels unavailable; retaining budget balances.", labelError);
    }
  }
  const budgetBalancesByCoa = addBudgetCoaLabels(context.budgetBalancesByCoa, accounts);
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
      budgetBalancesByCoa,
      isLiquidated: context.plan?.isLiquidated ?? false,
      supplierEligibility: eligibility,
      submissions: context.submissions,
    },
  });
}
