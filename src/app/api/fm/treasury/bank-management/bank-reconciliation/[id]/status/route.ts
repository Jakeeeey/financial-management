import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  asNumber,
  asString,
  directusFetch,
  DirectusItem,
  getTokenUserId,
  jsonError,
} from "../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReconciliationStatus = "DRAFT" | "RECONCILED";

type BankReconciliationStatusRow = {
  id?: unknown;
  status?: unknown;
  variance?: unknown;
  approved_by?: unknown;
};

const validStatuses: ReconciliationStatus[] = ["DRAFT", "RECONCILED"];

function isReconciliationStatus(value: string): value is ReconciliationStatus {
  return validStatuses.includes(value as ReconciliationStatus);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const reconciliationId = asNumber(id);
    if (!reconciliationId) {
      return NextResponse.json(
        { error: "Invalid reconciliation id" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const nextStatus = asString(
      searchParams.get("status") ?? body.status,
    ).toUpperCase();

    if (!isReconciliationStatus(nextStatus)) {
      return NextResponse.json(
        { error: "Invalid reconciliation status" },
        { status: 400 },
      );
    }

    const existing = await directusFetch<
      DirectusItem<BankReconciliationStatusRow>
    >(
      `/items/bank_reconciliation/${reconciliationId}?fields=id,status,variance,approved_by`,
    );
    const currentStatus = asString(existing.data?.status).toUpperCase();

    if (!isReconciliationStatus(currentStatus)) {
      return NextResponse.json(
        { error: "Current reconciliation status is invalid" },
        { status: 409 },
      );
    }

    if (currentStatus !== "DRAFT" || nextStatus !== "RECONCILED") {
      return NextResponse.json(
        { error: `Cannot change reconciliation from ${currentStatus} to ${nextStatus}` },
        { status: 409 },
      );
    }

    const variance = asNumber(existing.data?.variance) ?? 0;
    if (Math.abs(variance) >= 0.005) {
      return NextResponse.json(
        { error: "Only zero-variance reconciliations can be marked reconciled" },
        { status: 409 },
      );
    }

    const cookieStore = await cookies();
    const userId = getTokenUserId(cookieStore.get("vos_access_token")?.value);
    if (!userId) {
      return NextResponse.json(
        { error: "Unable to identify the current user" },
        { status: 401 },
      );
    }

    const updated = await directusFetch<
      DirectusItem<BankReconciliationStatusRow>
    >(`/items/bank_reconciliation/${reconciliationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: nextStatus,
        approved_by: userId,
      }),
    });

    return NextResponse.json({
      reconciliation: {
        id: asNumber(updated.data?.id) ?? reconciliationId,
        status: asString(updated.data?.status) || nextStatus,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
