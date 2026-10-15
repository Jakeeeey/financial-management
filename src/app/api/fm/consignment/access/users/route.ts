import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.toString();
  return proxySpring(`/api/consignment/access/users${query ? `?${query}` : ""}`);
}
