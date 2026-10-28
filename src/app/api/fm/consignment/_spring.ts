import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export async function readConsignment(path: string, init?: RequestInit) {
  const response = await proxySpring(path, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
