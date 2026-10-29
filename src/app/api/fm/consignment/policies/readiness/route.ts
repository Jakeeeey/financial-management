import { readConsignment } from "../../_spring";
export const dynamic = "force-dynamic";
export function GET() { return readConsignment("/api/consignment/policies/readiness"); }
