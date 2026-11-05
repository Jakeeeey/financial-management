import { retryAfterSeconds } from "@/modules/financial-management/reports/logistics-wer/utils/retry-after";
import { randomUUID } from "node:crypto";

export const BUSY_MESSAGE = "The service is temporarily busy. Your entries have been kept. Please refresh the submission status before trying again.";
export class WerDependencyError extends Error {
  mutationOutcome?: "not_applied" | "applied" | "unknown";
  constructor(readonly upstreamStatus: number, readonly upstreamCode: string | null, readonly retryAfterSeconds?: number, readonly requestId: string = randomUUID()) {
    super(upstreamStatus === 429 ? "Too many requests. Please wait before trying again. Your entries have been kept." : BUSY_MESSAGE);
    this.name = "WerDependencyError";
  }
}
export function publicWerFailure(cause: unknown, outcome: "not_applied" | "applied" | "unknown" = "not_applied", submissionId?: number) {
  const dependency = cause instanceof WerDependencyError;
  return {
    message: dependency ? cause.message : "Unable to complete this request. Refresh the submission status before trying again.",
    code: dependency ? (cause.upstreamStatus === 429 ? "WER_RATE_LIMITED" : "WER_DEPENDENCY_UNAVAILABLE") : "WER_REQUEST_FAILED",
    requestId: dependency ? cause.requestId : randomUUID(),
    outcome: dependency ? cause.mutationOutcome ?? outcome : outcome,
    ...(submissionId ? { submissionId } : {}),
    ...(dependency && (cause.retryAfterSeconds || cause.upstreamStatus === 429) ? { retryAfterSeconds: cause.retryAfterSeconds ?? 10 } : {}),
  };
}


export function dependencyFromResponse(response: Response, service: string): WerDependencyError {
  const failure = new WerDependencyError(response.status, `${service.toUpperCase()}_HTTP_${response.status}`, response.status === 429 ? retryAfterSeconds(response.headers.get("Retry-After")) : undefined);
  console.warn("[WER upstream rejection]", { service, status: response.status, requestId: failure.requestId, retryAfterSeconds: failure.retryAfterSeconds });
  return failure;
}
export function werFailureStatus(cause: unknown): number {
  return cause instanceof WerDependencyError && cause.upstreamStatus === 429 ? 429 : 503;
}
export function werFailureResponse(cause: unknown, outcome: "not_applied" | "applied" | "unknown" = "not_applied", upstream?: Response) {
  const payload = publicWerFailure(cause, outcome);
  const response = Response.json(payload, { status: outcome === "applied" ? 200 : werFailureStatus(cause), headers: payload.retryAfterSeconds ? { "Retry-After": String(payload.retryAfterSeconds) } : undefined });
  for (const cookie of upstream?.headers.getSetCookie() ?? []) response.headers.append("set-cookie", cookie);
  return response;
}
