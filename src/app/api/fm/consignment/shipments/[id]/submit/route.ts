import { NextRequest } from "next/server";
import { readConsignment } from "../../../_spring";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return readConsignment(`/api/consignment/shipments/${encodeURIComponent((await params).id)}/submit`,{method:"POST",body:await request.text()});}
