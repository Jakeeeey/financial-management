import { dependencyFromResponse, werFailureResponse } from "./_errors";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export async function getSpringDispatchPlanDetail(planId: number): Promise<Response> {
  const encodedId = encodeURIComponent(String(planId));
  const singularResponse = await proxySpring(`/api/v1/dispatch-approval/${encodedId}`);
  if (singularResponse.status === 429) return werFailureResponse(dependencyFromResponse(singularResponse, "spring"), "not_applied", singularResponse);
  if (singularResponse.status !== 404) return singularResponse;

  // Support the legacy plural endpoint until the deployed backend migrates.
  const response = await proxySpring(`/api/v1/dispatch-approvals/${encodedId}`);
  return response.status === 429 ? werFailureResponse(dependencyFromResponse(response, "spring"), "not_applied", response) : response;
}
