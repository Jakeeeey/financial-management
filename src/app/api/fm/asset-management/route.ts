import {
  createAsset,
  fetchAssets,
  fetchDepartments,
  fetchItemClassifications,
  fetchItemTypes,
  fetchItems,
  fetchUsers,
  updateAsset,
} from "@/modules/financial-management/asset-management/services/asset";
import { NextResponse } from "next/server";

/**
 * GET Handler
 * Supports individual lookups (departments, users, etc.) or full asset list
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    let data;
    switch (type) {
      case "departments":
        data = await fetchDepartments();
        break;
      case "users":
        data = await fetchUsers();
        break;
      case "item_types":
        data = await fetchItemTypes();
        break;
      case "item_classifications":
        data = await fetchItemClassifications();
        break;
      case "items":
        data = await fetchItems();
        break;
      default:
        data = await fetchAssets();
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST Handler
 * Create new asset and associated base item
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createAsset(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("POST Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH Handler
 * Update existing asset and associated base item
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const result = await updateAsset(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("PATCH Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
