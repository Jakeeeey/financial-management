import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxySpring("/api/view-general-ledger-master/filter-options");
}
