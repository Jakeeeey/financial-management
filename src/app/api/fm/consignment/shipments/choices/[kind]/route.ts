import { NextRequest,NextResponse } from "next/server";
import { readConsignment } from "../../../_spring";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest,{params}:{params:Promise<{kind:string}>}){const {kind}=await params;if(!["agreements","products"].includes(kind))return NextResponse.json({message:"Invalid choice type"},{status:400});return readConsignment(`/api/consignment/shipments/choices/${kind}?${request.nextUrl.searchParams}`);}
