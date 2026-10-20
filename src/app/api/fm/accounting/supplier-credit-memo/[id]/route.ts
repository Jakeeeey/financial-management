import { memoRoutes } from "../../_supplier-memos/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = memoRoutes(1);
export const GET = handlers.detail;
export const PATCH = handlers.edit;
