import { NextResponse } from "next/server";

const DIRECTUS_URL = "http://goatedcodoer:8056";
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

// ============================================================================
// HELPERS
// ============================================================================

async function ensureReferenceExists(
  collection: string,
  fieldName: string,
  value: string | number,
) {
  if (!value) return null;

  if (
    typeof value === "number" ||
    (!isNaN(Number(value)) && typeof value !== "string")
  ) {
    return Number(value);
  }

  const searchRes = await fetch(
    `${DIRECTUS_URL}/items/${collection}?filter[${fieldName}][_eq]=${encodeURIComponent(value.toString())}`,
    { headers: AUTH_HEADERS },
  );
  const searchJson = await searchRes.json();

  if (searchJson.data && searchJson.data.length > 0) {
    return searchJson.data[0].id;
  }

  const createRes = await fetch(`${DIRECTUS_URL}/items/${collection}`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ [fieldName]: value }),
  });

  const createJson = await createRes.json();
  if (!createRes.ok) {
    throw new Error(
      `Failed to create new ${collection}: ${createJson.errors?.[0]?.message}`,
    );
  }

  return createJson.data.id;
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    // Individual Lookups
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
    if (type === "item_types") {
      const res = await fetch(`${DIRECTUS_URL}/items/item_type?limit=-1`, {
        headers: AUTH_HEADERS,
      });
      const json = await res.json();
      return NextResponse.json(json.data || []);
    }
    if (type === "item_classifications") {
      const res = await fetch(
        `${DIRECTUS_URL}/items/item_classification?limit=-1`,
        { headers: AUTH_HEADERS },
      );
      const json = await res.json();
      return NextResponse.json(json.data || []);
    }

    // Main Parallel Fetch - FIXED variable destructuring to avoid shadowing errors
    const [assetsRes, itemsRes, deptsRes, usersRes, tRes, cRes] =
      await Promise.all([
        fetch(`${DIRECTUS_URL}/items/assets_and_equipment?limit=-1&sort=-id`, {
          headers: AUTH_HEADERS,
          cache: "no-store",
        }),
        fetch(
          `${DIRECTUS_URL}/items/items?fields=id,item_name,item_type,item_classification&limit=-1`,
          { headers: AUTH_HEADERS },
        ),
        fetch(`${DIRECTUS_URL}/items/department?limit=-1`, {
          headers: AUTH_HEADERS,
        }),
        fetch(`${DIRECTUS_URL}/items/user?limit=-1`, { headers: AUTH_HEADERS }),
        fetch(`${DIRECTUS_URL}/items/item_type?limit=-1`, {
          headers: AUTH_HEADERS,
        }),
        fetch(`${DIRECTUS_URL}/items/item_classification?limit=-1`, {
          headers: AUTH_HEADERS,
        }),
      ]);

    if (
      !assetsRes.ok ||
      !itemsRes.ok ||
      !deptsRes.ok ||
      !usersRes.ok ||
      !tRes.ok ||
      !cRes.ok
    ) {
      throw new Error("Failed to fetch data from Directus");
    }

    const assetsJson = await assetsRes.json();
    const itemsJson = await itemsRes.json();
    const deptsJson = await deptsRes.json();
    const usersJson = await usersRes.json();
    const typeJson = await tRes.json();
    const classJson = await cRes.json();

    // Mapping logic
    const itemsMap = new Map(
      (itemsJson.data || []).map((i: any) => [Number(i.id), i]),
    );
    const deptsMap = new Map(
      (deptsJson.data || []).map((d: any) => [
        Number(d.department_id),
        d.department_name,
      ]),
    );
    const usersMap = new Map(
      (usersJson.data || []).map((u: any) => [
        Number(u.user_id),
        `${u.user_fname} ${u.user_lname}`.trim(),
      ]),
    );
    const typesMap = new Map(
      (typeJson.data || []).map((t: any) => [Number(t.id), t.type_name]),
    );
    const classMap = new Map(
      (classJson.data || []).map((c: any) => [
        Number(c.id),
        c.classification_name,
      ]),
    );

    const mergedData = (assetsJson.data || []).map((asset: any) => {
      const baseItem = itemsMap.get(Number(asset.item_id)) as any;
      return {
        ...asset,
        item_name: baseItem?.item_name ?? "N/A",
        item_type_name: typesMap.get(Number(baseItem?.item_type)) ?? "N/A",
        classification_name:
          classMap.get(Number(baseItem?.item_classification)) ?? "N/A",
        department_name: deptsMap.get(Number(asset.department)) ?? "Unassigned",
        assigned_to_name: usersMap.get(Number(asset.employee)) ?? "Unassigned",
        item_image: asset.item_image,
      };
    });

    return NextResponse.json(mergedData);
  } catch (error: any) {
    console.error("GET Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const typeId = await ensureReferenceExists(
      "item_type",
      "type_name",
      body.item_type,
    );
    const classId = await ensureReferenceExists(
      "item_classification",
      "classification_name",
      body.item_classification,
    );

    const itemRes = await fetch(`${DIRECTUS_URL}/items/items`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        item_name: body.item_name,
        item_type: typeId,
        item_classification: classId,
      }),
    });

    const itemData = await itemRes.json();
    if (!itemRes.ok)
      throw new Error(itemData.errors?.[0]?.message || "Failed to create item");

    const itemId = itemData.data.id;

    let dateStr: string;
    const dateInput = body.date_acquired;

    if (!dateInput) {
      dateStr = new Date().toISOString().split("T")[0];
    } else if (typeof dateInput === "string") {
      // String format (which is what .toISOString() produces from the frontend)
      try {
        const parsedDate = new Date(dateInput);
        if (isNaN(parsedDate.getTime())) {
          console.warn("Invalid date string received:", dateInput);
          dateStr = new Date().toISOString().split("T")[0];
        } else {
          dateStr = parsedDate.toISOString().split("T")[0];
        }
      } catch (error) {
        console.error("Date parsing error:", error);
        dateStr = new Date().toISOString().split("T")[0];
      }
    } else {
      // Fallback for any other type
      dateStr = new Date().toISOString().split("T")[0];
    }

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
      encoder: 81,
      item_image: body.item_image || null,
      classification_name: body.item_classification,
    };

    console.log("DEBUG: assetPayload:", JSON.stringify(assetPayload, null, 2));

    const assetRes = await fetch(`${DIRECTUS_URL}/items/assets_and_equipment`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(assetPayload),
    });

    const assetData = await assetRes.json();
    if (!assetRes.ok)
      throw new Error(
        assetData.errors?.[0]?.message || "Failed to create asset",
      );

    return NextResponse.json({ success: true, data: assetData.data });
  } catch (error: any) {
    console.error("POST Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
// ============================================================================
// PATCH HANDLER (Dual-Table Strategic Update)
// ============================================================================

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, item_id, ...updateData } = body;

    if (!id || !item_id)
      throw new Error("Asset ID and Item ID are required for updates");

    // 1. Update References & Base Item
    const typeId = await ensureReferenceExists(
      "item_type",
      "type_name",
      updateData.item_type_name,
    );
    const classId = await ensureReferenceExists(
      "item_classification",
      "classification_name",
      updateData.classification_name,
    );

    const itemUpdateRes = await fetch(
      `${DIRECTUS_URL}/items/items/${item_id}`,
      {
        method: "PATCH",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          item_name: updateData.item_name,
          item_type: typeId,
          item_classification: classId,
        }),
      },
    );

    if (!itemUpdateRes.ok)
      throw new Error("Failed to update base item details");

    // 2. Update Asset Record & Recalculate PHP Total
    const assetPayload = {
      condition: updateData.condition,
      cost_per_item: Number(updateData.cost_per_item),
      quantity: Number(updateData.quantity),
      total: Number(updateData.cost_per_item) * Number(updateData.quantity),
      life_span: Number(updateData.life_span),
      date_acquired: updateData.date_acquired?.split("T")[0],
      department: Number(updateData.department),
      employee: updateData.employee ? Number(updateData.employee) : null,
      item_image: updateData.item_image,
      barcode: updateData.barcode,
      rfid_code: updateData.rfid_code,
    };

    const assetUpdateRes = await fetch(
      `${DIRECTUS_URL}/items/assets_and_equipment/${id}`,
      {
        method: "PATCH",
        headers: AUTH_HEADERS,
        body: JSON.stringify(assetPayload),
      },
    );

    const assetResult = await assetUpdateRes.json();
    if (!assetUpdateRes.ok)
      throw new Error(
        assetResult.errors?.[0]?.message ||
          "Failed to update asset equipment record",
      );

    return NextResponse.json({ success: true, data: assetResult.data });
  } catch (error: any) {
    console.error("PATCH Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
