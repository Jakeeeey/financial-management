import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET() {
  try {
    const query = new URLSearchParams({
      fields:
        "*,item_id.item_name,department.department_name,employee.first_name,employee.last_name",
    });

    const res = await fetch(`${API_URL}/items/assets_and_equipment?${query}`, {
      headers: HEADERS,
      cache: "no-store",
    });

    const result = await res.json();

    // Map data to match your 'JoinedAsset' interface
    const formatted = (result.data || []).map((asset: any) => ({
      ...asset,
      item_name_display: asset.item_id?.item_name || "N/A",
      department_name: asset.department?.department_name || "N/A",
      employee_name: asset.employee
        ? `${asset.employee.first_name} ${asset.employee.last_name}`
        : "Unassigned",
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Create the base item
    const itemRes = await fetch(`${API_URL}/items/items`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        item_name: body.item_name,
        item_type: body.item_type,
        item_classification: body.item_classification,
      }),
    });
    const itemData = await itemRes.json();

    // 2. Create the asset record
    const assetRes = await fetch(`${API_URL}/items/assets_and_equipment`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        item_id: itemData.data.id,
        department: body.department,
        employee: body.employee,
        quantity: body.quantity,
        cost_per_item: body.cost_per_item,
        life_span: body.life_span,
        condition: body.condition,
        date_acquired: body.date_acquired,
        rfid_code: body.rfid_code,
        barcode: body.barcode,
        total: Number(body.quantity) * Number(body.cost_per_item),
        encoder: 81,
      }),
    });

    const assetData = await assetRes.json();
    return NextResponse.json(assetData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
