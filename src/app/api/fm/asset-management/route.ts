import { NextResponse } from "next/server";

const DIRECTUS_URL = "http://goatedcodoer:8056";
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

// ============================================================================
// GET HANDLER - Fetch assets with virtual joins
// ============================================================================

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    // Handle specific data type requests
    if (type === "departments") {
      const res = await fetch(`${DIRECTUS_URL}/items/department?limit=-1`, {
        headers: AUTH_HEADERS,
      });
      const json = await res.json();
      return NextResponse.json(json.data || []);
    }

    if (type === "users") {
      const res = await fetch(`${DIRECTUS_URL}/items/user?limit=-1`, {
        headers: AUTH_HEADERS,
      });
      const json = await res.json();
      return NextResponse.json(json.data || []);
    }

    // Fetch all data in parallel for main asset list
    const [assetsRes, itemsRes, deptsRes, usersRes] = await Promise.all([
      fetch(`${DIRECTUS_URL}/items/assets_and_equipment?limit=-1&sort=-id`, {
        headers: AUTH_HEADERS,
        cache: "no-store",
      }),
      fetch(`${DIRECTUS_URL}/items/items?fields=id,item_name&limit=-1`, {
        headers: AUTH_HEADERS,
      }),
      fetch(`${DIRECTUS_URL}/items/department?limit=-1`, {
        headers: AUTH_HEADERS,
      }),
      fetch(`${DIRECTUS_URL}/items/user?limit=-1`, {
        headers: AUTH_HEADERS,
      }),
    ]);

    // Check for API errors
    if (!assetsRes.ok || !itemsRes.ok || !deptsRes.ok || !usersRes.ok) {
      throw new Error("Failed to fetch data from Directus");
    }

    const assetsJson = await assetsRes.json();
    const itemsJson = await itemsRes.json();
    const deptsJson = await deptsRes.json();
    const usersJson = await usersRes.json();

    // Create lookup maps for efficient joining
    const itemsMap = new Map(
      (itemsJson.data || []).map((i: any) => [Number(i.id), i.item_name]),
    );

    const deptsMap = new Map(
      (deptsJson.data || []).map((d: any) => [
        Number(d.department_id),
        d.department_name,
      ]),
    );

    const usersMap = new Map(
      (usersJson.data || []).map((u: any) => {
        const fullName = `${u.user_fname} ${u.user_lname}`.trim();
        return [Number(u.user_id), fullName];
      }),
    );

    // Perform virtual joins
    const mergedData = (assetsJson.data || []).map((asset: any) => {
      return {
        id: asset.id,
        barcode: asset.barcode,
        rfid_code: asset.rfid_code,
        condition: asset.condition,
        quantity: asset.quantity,
        cost_per_item: asset.cost_per_item,
        total: asset.total,
        date_acquired: asset.date_acquired,
        life_span: asset.life_span,

        // Virtual joined fields
        item_name: itemsMap.get(Number(asset.item_id)) ?? "N/A",
        department_name: deptsMap.get(Number(asset.department)) ?? "Unassigned",
        assigned_to_name: usersMap.get(Number(asset.employee)) ?? "Unassigned",

        // Keep raw IDs for reference
        item_id: asset.item_id,
        department: asset.department,
        employee: asset.employee,
        encoder: asset.encoder,
      };
    });

    return NextResponse.json(mergedData);
  } catch (error: any) {
    console.error("GET /api/fm/asset-management error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST HANDLER - Create new asset with two-step process
// ============================================================================

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.item_name || !body.department) {
      return NextResponse.json(
        { error: "Missing required fields: item_name, department" },
        { status: 400 },
      );
    }

    // ========================================================================
    // STEP 1: Create base item in 'items' collection
    // ========================================================================

    const itemPayload = {
      item_name: body.item_name,
      item_type: Number(body.item_type) || 2,
      item_classification: Number(body.item_classification) || 1,
    };

    const itemRes = await fetch(`${DIRECTUS_URL}/items/items`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(itemPayload),
    });

    const itemData = await itemRes.json();

    if (!itemRes.ok) {
      console.error("Item creation failed:", itemData);
      throw new Error(itemData.errors?.[0]?.message || "Failed to create item");
    }

    const itemId = itemData.data.id;

    // ========================================================================
    // STEP 2: Format date for Directus (YYYY-MM-DD)
    // ========================================================================

    let dateStr: string;
    const dateInput = body.date_acquired;

    if (dateInput instanceof Date) {
      dateStr = dateInput.toISOString().split("T")[0];
    } else if (typeof dateInput === "string") {
      dateStr = dateInput.split("T")[0];
    } else {
      dateStr = new Date().toISOString().split("T")[0];
    }

    // ========================================================================
    // STEP 3: Create asset entry in 'assets_and_equipment' collection
    // ========================================================================

    const assetPayload = {
      item_id: itemId,
      condition: body.condition || "Good",
      cost_per_item: Number(body.cost_per_item) || 0,
      quantity: Number(body.quantity) || 1,
      total: Number(body.cost_per_item || 0) * Number(body.quantity || 1),
      life_span: Number(body.life_span) || 12,
      date_acquired: dateStr,
      department: Number(body.department),
      employee: body.employee ? Number(body.employee) : null,
      barcode: body.barcode || null,
      rfid_code: body.rfid_code || null,
      encoder: 81, // Hardcoded as per your setup
    };

    const assetRes = await fetch(`${DIRECTUS_URL}/items/assets_and_equipment`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(assetPayload),
    });

    const assetData = await assetRes.json();

    if (!assetRes.ok) {
      console.error("Asset creation failed:", assetData);
      throw new Error(
        assetData.errors?.[0]?.message || "Failed to create asset",
      );
    }

    return NextResponse.json({
      success: true,
      data: assetData.data,
    });
  } catch (error: any) {
    console.error("POST /api/fm/asset-management error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        details: error.toString(),
      },
      { status: 500 },
    );
  }
}
