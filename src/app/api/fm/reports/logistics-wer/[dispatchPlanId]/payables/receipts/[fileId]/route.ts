import { NextRequest, NextResponse } from "next/server";
import {
  DRAFT_COLLECTION,
  DRAFT_LINE_COLLECTION,
  DRAFT_RECEIPT_COLLECTION,
  directusFetch,
  directusWrite,
  requireSessionUserId,
} from "../../../../_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

/**
 * Remove a staged receipt. Rejected once the file is attached to a
 * submitted or approved payable.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string; fileId: string }> },
) {
  const { dispatchPlanId, fileId } = await params;
  const planId = Number(dispatchPlanId);
  if (!Number.isInteger(planId) || planId <= 0) {
    return error("dispatchPlanId must be a positive integer.", 400);
  }
  if (!fileId) return error("fileId is required.", 400);

  const userId = await requireSessionUserId(request);
  if (!userId) return error("Authentication is required to remove receipts.", 401);

  try {
    const params = new URLSearchParams({
      "filter[file_id][_eq]": fileId,
      fields: "id,line_id",
      limit: "-1",
    });
    const links = await directusFetch<{ data?: Array<{ id?: unknown; line_id?: unknown }> }>(
      `/items/${DRAFT_RECEIPT_COLLECTION}?${params.toString()}`,
    );

    for (const link of links.data ?? []) {
      const lineParams = new URLSearchParams({
        "filter[id][_eq]": String(Number(link.line_id) || 0),
        fields: "id,draft_id",
        limit: "1",
      });
      const line = await directusFetch<{ data?: Array<{ draft_id?: unknown }> }>(
        `/items/${DRAFT_LINE_COLLECTION}?${lineParams.toString()}`,
      );
      const ownerDraftId = Number(line.data?.[0]?.draft_id) || 0;
      if (!ownerDraftId) continue;
      const draftParams = new URLSearchParams({
        "filter[id][_eq]": String(ownerDraftId),
        fields: "id,status,dispatch_plan_id",
        limit: "1",
      });
      const draft = await directusFetch<{ data?: Array<{ status?: unknown; dispatch_plan_id?: unknown }> }>(
        `/items/${DRAFT_COLLECTION}?${draftParams.toString()}`,
      );
      const owner = draft.data?.[0];
      if (!owner) continue;
      if (Number(owner.dispatch_plan_id) !== planId) {
        return error("This receipt belongs to a different dispatch plan.", 403);
      }
      const status = String(owner.status || "").toLowerCase();
      if (status === "submitted" || status === "approved") {
        return error("Receipts attached to a submitted or approved payable cannot be removed.", 403);
      }
      await directusWrite("DELETE", `/items/${DRAFT_RECEIPT_COLLECTION}/${Number(link.id)}`);
    }

    const response = await fetch(`${DIRECTUS_URL}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!response.ok && response.status !== 404) {
      return error("Unable to remove the receipt file.", 502);
    }
    return new Response(null, { status: 204 });
  } catch (requestError) {
    console.error("[Logistics WER] Receipt removal failed:", requestError);
    return error("Unable to remove the receipt.", 502);
  }
}
