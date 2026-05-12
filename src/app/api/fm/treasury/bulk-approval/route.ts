// src/app/api/fm/treasury/bulk-approval/route.ts
import { NextRequest } from "next/server";
import { jsonResponse, serverErrorResponse } from "@/modules/financial-management/treasury/bulk-approval/services/http";
import { createBulkApprovalContext, getApprovalContextsForUser } from "@/modules/financial-management/treasury/bulk-approval/services/bulkApproval.shared";
import { handleFinalHeaderDecision, handleFinalTopSheetsGetResource } from "@/modules/financial-management/treasury/bulk-approval/services/finalTopSheets.service";
import { handleMyLevelApprovalGetResource, submitMyLevelApprovalVote } from "@/modules/financial-management/treasury/bulk-approval/services/myLevelApproval.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const contextResult = await createBulkApprovalContext(req);
    if (!contextResult.ok) {
      return jsonResponse(contextResult.body, { status: contextResult.status });
    }

    const context = contextResult.context;
    const searchParams = req.nextUrl.searchParams;
    const resource = searchParams.get("resource") || "drafts";

    if (resource === "my-access") {
      return jsonResponse({ data: context.approverRecords });
    }

    if (resource === "my-approval-contexts") {
      const contexts = await getApprovalContextsForUser({
        approverRecords: context.approverRecords,
        allApprovers: context.allApprovers,
      });

      return jsonResponse({ data: contexts });
    }

    const finalTopSheetResponse = await handleFinalTopSheetsGetResource({
      resource,
      searchParams,
      context,
    });

    if (finalTopSheetResponse) return finalTopSheetResponse;

    const myLevelResponse = await handleMyLevelApprovalGetResource({
      resource,
      searchParams,
      context,
    });

    if (myLevelResponse) return myLevelResponse;

    return jsonResponse({ error: "Unknown resource" }, { status: 400 });
  } catch (error: unknown) {
    return serverErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const contextResult = await createBulkApprovalContext(req);

    if (!contextResult.ok) {
      const status = contextResult.status === 403 ? 403 : contextResult.status;
      const bodyPayload =
        status === 403
          ? { error: "Forbidden: Not an authorized approver" }
          : contextResult.body;

      return jsonResponse(bodyPayload, { status });
    }

    if (body.resource === "final-header-decision") {
      return handleFinalHeaderDecision({
        body,
        context: contextResult.context,
      });
    }

    return submitMyLevelApprovalVote({
      body,
      context: contextResult.context,
    });
  } catch (error: unknown) {
    return serverErrorResponse(error);
  }
}
