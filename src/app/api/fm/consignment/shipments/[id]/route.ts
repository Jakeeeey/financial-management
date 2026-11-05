import { NextRequest } from "next/server";
import { readConsignment } from "../../_spring";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){return readConsignment(`/api/consignment/shipments/${encodeURIComponent((await params).id)}`);}
export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){return readConsignment(`/api/consignment/shipments/${encodeURIComponent((await params).id)}`,{method:"PUT",body:await request.text()});}
