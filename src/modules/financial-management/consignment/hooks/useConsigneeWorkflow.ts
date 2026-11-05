"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConsigneeSaveError, consigneeCommand } from "../providers/consignees.api";
import type { ConsigneeDetail, ConsignmentWorkspace } from "../types";

export type ConsigneeWorkflowIntent = "submit" | "approve" | "reject" | "replacement-draft" | "withdraw";

function successMessage(intent: ConsigneeWorkflowIntent, code: string) {
  switch (intent) {
    case "submit": return `${code} submitted for review.`;
    case "approve": return `${code} approved and is now Active.`;
    case "reject": return `${code} rejected.`;
    case "withdraw": return `${code} withdrawn to Draft for editing.`;
    case "replacement-draft": return `Replacement draft ${code} created.`;
  }
}

function failureTitle(intent: ConsigneeWorkflowIntent) {
  switch (intent) {
    case "submit": return "Submission failed";
    case "approve": return "Approval failed";
    case "reject": return "Rejection failed";
    case "withdraw": return "Withdrawal failed";
    case "replacement-draft": return "Replacement draft failed";
  }
}

export function useConsigneeWorkflow({ detail, workspace, reason, setReason, onChanged }: {
  detail: ConsigneeDetail | null; workspace: ConsignmentWorkspace; reason: string;
  setReason: (value: string) => void; onChanged: (detail: ConsigneeDetail) => void;
}) {
  const [intent, setIntent] = useState<ConsigneeWorkflowIntent | null>(null);
  const [failure, setFailure] = useState<ConsigneeSaveError | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    setIntent(null);
    setFailure(null);
    setBusy(false);
    setRequestId(crypto.randomUUID());
  }, [detail?.summary.id, detail?.version, workspace]);

  const mustReload = !!failure && (failure.status === 409 || failure.status === 401 || failure.status === 403 || ((failure.status === 0 || failure.status >= 500) && intent !== "replacement-draft"));
  const confirmDisabled = busy || mustReload || !intent || (intent === "reject" && (!reason.trim() || reason.trim().length > 1000)) || reason.length > 1000;

  function request(nextIntent: ConsigneeWorkflowIntent) {
    setFailure(null);
    setReason("");
    setIntent(nextIntent);
  }

  function cancel() {
    if (busy || mustReload) return;
    setIntent(null);
    setFailure(null);
  }

  async function confirm() {
    if (!detail || !intent || busy || mustReload) return;
    const action = intent;
    if (action === "reject" && (!reason.trim() || reason.trim().length > 1000)) {
      const failure = new ConsigneeSaveError("Enter a rejection reason of 1 to 1,000 characters.", 400);
      setFailure(failure);
      toast.error(failureTitle(action), { description: failure.message });
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const result = await consigneeCommand(workspace, detail.summary.id, action, detail.version, reason, requestId);
      setReason("");
      setIntent(null);
      toast.success(successMessage(action, result.summary.code));
      onChanged(result);
    } catch (cause) {
      const failure = cause instanceof ConsigneeSaveError ? cause : new ConsigneeSaveError("The action could not be confirmed. Reload the preview to check its saved status.", 0);
      setFailure(failure);
      toast.error(failureTitle(action), { description: failure.message });
    } finally {
      setBusy(false);
    }
  }

  return { intent, failure, busy, mustReload, confirmDisabled, request, cancel, confirm };
}
