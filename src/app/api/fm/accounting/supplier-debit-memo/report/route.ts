import { memoRoutes } from "../../_supplier-memos/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = memoRoutes(2);
export const GET = handlers.report;
