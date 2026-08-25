import { NextRequest, NextResponse } from "next/server";
import {
  asNumber,
  asString,
  directusFetch,
  DirectusItem,
  jsonError,
} from "../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransferStatus = "PREPARED" | "PENDING" | "COMPLETED" | "CANCELLED";

type BankTransferStatusRow = {
  transfer_id?: unknown;
  status?: unknown;
};

const validStatuses: TransferStatus[] = [
  "PREPARED",
  "PENDING",
  "COMPLETED",
  "CANCELLED",
];

const allowedTransitions: Record<TransferStatus, TransferStatus[]> = {
  PREPARED: ["PENDING", "CANCELLED"],
  PENDING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

function isTransferStatus(value: string): value is TransferStatus {
  return validStatuses.includes(value as TransferStatus);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const transferId = asNumber(id);
    if (!transferId) {
      return NextResponse.json({ error: "Invalid transfer_id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const nextStatus = asString(searchParams.get("status") ?? body.status).toUpperCase();

    if (!isTransferStatus(nextStatus)) {
      return NextResponse.json(
        { error: "Invalid transfer status" },
        { status: 400 },
      );
    }

    const existing = await directusFetch<DirectusItem<BankTransferStatusRow>>(
      `/items/bank_transfers/${transferId}?fields=transfer_id,status`,
    );
    const currentStatus = asString(existing.data?.status).toUpperCase();

    if (!isTransferStatus(currentStatus)) {
      return NextResponse.json(
        { error: "Current transfer status is invalid" },
        { status: 409 },
      );
    }

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Cannot change transfer from ${currentStatus} to ${nextStatus}`,
        },
        { status: 409 },
      );
    }

    const updated = await directusFetch<DirectusItem<BankTransferStatusRow>>(
      `/items/bank_transfers/${transferId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      },
    );

    return NextResponse.json({
      transfer: {
        transferId: asNumber(updated.data?.transfer_id) ?? transferId,
        status: asString(updated.data?.status) || nextStatus,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
