import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export async function readConsignment(path: string) {
  const response = await proxySpring(path);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
