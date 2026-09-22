import { NextRequest, NextResponse } from "next/server";
import {
  getPlanBaseline,
  requireSessionUserId,
} from "../../../_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

/**
 * Stage a receipt file for a dispatch plan. Returns the Directus file id to
 * attach to payable lines in the payables POST. The file is unattached until
 * a draft references it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string }> },
) {
  const { dispatchPlanId } = await params;
  const planId = Number(dispatchPlanId);
  if (!Number.isInteger(planId) || planId <= 0) {
    return error("dispatchPlanId must be a positive integer.", 400);
  }

  const userId = await requireSessionUserId(request);
  if (!userId) return error("Authentication is required to upload receipts.", 401);

  let baseline;
  try {
    baseline = await getPlanBaseline(planId);
  } catch (planError) {
    console.error("[Logistics WER] Receipt upload plan lookup failed:", planError);
    return error("Unable to load the dispatch plan.", 502);
  }
  if (!baseline) return error("Dispatch plan not found.", 404);
  if (baseline.isLiquidated) {
    return error("Receipts cannot be staged for liquidated dispatch plans.", 409);
  }
  if ((baseline.status || "").toLowerCase() !== "for clearance") {
    return error("Receipts can only be staged for plans in For Clearance state.", 409);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error("Request body must be multipart form data with a file field.", 400);
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return error("A non-empty file field is required.", 400);
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return error("Receipt files must not exceed 10 MB.", 400);
  }

  try {
    const forward = new FormData();
    forward.append("file", file, file.name || "receipt");
    const upload = await fetch(`${DIRECTUS_URL}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body: forward,
      cache: "no-store",
    });
    const payload = await upload.json().catch(() => null);
    if (!upload.ok) {
      console.error("[Logistics WER] Receipt upload failed:", payload);
      return error("Unable to store the receipt file.", 502);
    }
    const fileId = (payload as { data?: { id?: unknown } })?.data?.id;
    if (!fileId) return error("Unable to store the receipt file.", 502);
    return NextResponse.json(
      {
        fileId: String(fileId),
        fileName: file.name || null,
        fileSize: file.size,
        uploadedBy: userId,
      },
      { status: 201 },
    );
  } catch (uploadError) {
    console.error("[Logistics WER] Receipt upload failed:", uploadError);
    return error("Unable to store the receipt file.", 502);
  }
}
