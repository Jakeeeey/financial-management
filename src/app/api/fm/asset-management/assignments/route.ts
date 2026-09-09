import { NextResponse } from "next/server";
import {
  fetchAssetAssignments,
  createAssetAssignment,
  returnAssetAssignment,
} from "@/modules/financial-management/asset-management/services/asset";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("asset_id");
    
    if (!assetId) {
      return NextResponse.json({ error: "asset_id is required" }, { status: 400 });
    }

    const data = await fetchAssetAssignments(Number(assetId));
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("GET Assignments Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = await createAssetAssignment(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("POST Assignment Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { assignment_id: number } & Record<string, unknown>;
    if (!body.assignment_id) {
       return NextResponse.json({ error: "assignment_id is required" }, { status: 400 });
    }
    const { assignment_id, ...updateData } = body;
    const result = await returnAssetAssignment(assignment_id, updateData);
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("PATCH Assignment Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
