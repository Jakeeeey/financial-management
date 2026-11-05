import { NextRequest, NextResponse } from "next/server";
import { readConsignment } from "../../../_spring";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^[1-9]\d*$/.test(id))return NextResponse.json({message:"Invalid shipment ID."},{status:400});
  return readConsignment(`/api/consignment/shipments/${encodeURIComponent(id)}/post`,{method:"POST",body:await request.text()});
}
