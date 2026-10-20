import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export async function getSpringDispatchPlanDetail(planId: number): Promise<Response> {
  const encodedId = encodeURIComponent(String(planId));
  const singularResponse = await proxySpring(`/api/v1/dispatch-approval/${encodedId}`);
  if (singularResponse.status !== 404) return singularResponse;

  // Support the legacy plural endpoint until the deployed backend migrates.
  return proxySpring(`/api/v1/dispatch-approvals/${encodedId}`);
}
