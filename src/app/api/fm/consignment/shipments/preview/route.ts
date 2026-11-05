import { NextRequest } from "next/server";
import { readConsignment } from "../../_spring";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){return readConsignment("/api/consignment/shipments/preview",{method:"POST",body:await request.text()});}
