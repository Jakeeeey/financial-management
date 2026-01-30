import { AssetFormValues } from "@/modules/financial-management/asset-management/types";
import { NextResponse } from "next/server";

const DIRECTUS_URL = "http://goatedcodoer:8056";
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

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

    const [assetsRes, itemsRes, deptsRes, usersRes] = await Promise.all([
      fetch(`${DIRECTUS_URL}/items/assets_and_equipment?limit=-1&sort=-id`, {
        headers: AUTH_HEADERS,
        cache: "no-store",
      }),
      fetch(
        `${DIRECTUS_URL}/items/items?fields=id,item_name,item_type.type_name,item_classification.classification_name&limit=-1`,
        { headers: AUTH_HEADERS },
      ),
      fetch(`${DIRECTUS_URL}/items/department?limit=-1`, {
        headers: AUTH_HEADERS,
      }),
      fetch(`${DIRECTUS_URL}/items/user?limit=-1`, { headers: AUTH_HEADERS }),
    ]);

    const assetsJson = await assetsRes.json();
    const itemsJson = await itemsRes.json();
    const deptsJson = await deptsRes.json();
    const usersJson = await usersRes.json();

    const itemsMap = new Map((itemsJson.data || []).map((i: any) => [i.id, i]));
    const deptsMap = new Map(
      (deptsJson.data || []).map((d: any) => [
        Number(d.department_id),
        d.department_name,
      ]),
    );

    // FIX: Match by user_id
    const usersMap = new Map(
      (usersJson.data || []).map((u: any) => {
        const fullName = `${u.user_fname} ${u.user_lname}`;
        return [Number(u.user_id), fullName];
      }),
    );

    const mergedData = (assetsJson.data || []).map((asset: any) => {
      const itemDetails = itemsMap.get(Number(asset.item_id)) as any;
      return {
        ...asset,
        item_name: itemDetails?.item_name || "N/A",
        // item_type_name: itemDetails?.item_type?.type_name || "N/A",
        // item_class_name:
        //   itemDetails?.item_classification?.classification_name || "N/A",
        department_name: deptsMap.get(Number(asset.department)) ?? "Unassigned",
        assigned_to_name: usersMap.get(Number(asset.employee)) ?? "Unassigned",
      };
    });

    return NextResponse.json(mergedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // 1. Bulletproof Casting
    // We cast to 'any' first then to 'AssetFormValues' to force TS to accept the structure
    const body = await req.json();
    const rawBody = body as unknown as AssetFormValues;

    // Step 1: Create generic Item
    const itemRes = await fetch(`${DIRECTUS_URL}/items/items`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        item_name: rawBody.item_name, // Resolves
        item_type: Number(rawBody.item_type) || 2,
        item_classification: Number(rawBody.item_classification) || 1,
      }),
    });

    const itemData = await itemRes.json();
    if (!itemRes.ok) throw new Error("Item creation failed");

    // 2. Date Handling fix for the 'split' error
    let dateStr: string;
    if (rawBody.date_acquired instanceof Date) {
      dateStr = rawBody.date_acquired.toISOString().split("T")[0];
    } else if (typeof rawBody.date_acquired === "string") {
      dateStr = rawBody.date_acquired.split("T")[0];
    } else {
      dateStr = new Date().toISOString().split("T")[0];
    }

    // Step 2: Create Asset
    const assetPayload = {
      item_id: itemData.data.id,
      condition: rawBody.condition,
      cost_per_item: Number(rawBody.cost_per_item),
      quantity: Number(rawBody.quantity),
      total: Number(rawBody.cost_per_item) * Number(rawBody.quantity),
      life_span: Number(rawBody.life_span),
      date_acquired: dateStr, // Safe string value
      department: rawBody.department,
      employee: rawBody.employee || null,
      encoder: 81,
    };

    const assetRes = await fetch(`${DIRECTUS_URL}/items/assets_and_equipment`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(assetPayload),
    });

    const assetData = await assetRes.json();
    if (!assetRes.ok)
      throw new Error(assetData.error?.message || "Asset creation failed");

    return NextResponse.json(assetData.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
