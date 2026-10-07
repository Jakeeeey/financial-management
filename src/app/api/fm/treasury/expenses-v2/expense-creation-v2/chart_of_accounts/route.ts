import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter");

    let directusUrl = `${API_BASE_URL}/items/chart_of_accounts?limit=-1&fields=coa_id,gl_code,account_title,status,account_type.id,account_type.account_name`;

    if (filter === "expense_only") {
      const allowedTypes = [
        "COST OF SALES",
        "COST OF SERVICE",
        "GENERAL AND ADMINISTRATIVE EXPENSES",
        "FINANCE COST",
      ].map((t) => encodeURIComponent(t)).join(",");

      directusUrl += `&filter[account_type][account_name][_in]=${allowedTypes}`;
    }

    const res = await fetch(directusUrl, {
      headers: AUTH_HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ data: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET COA Error:", err);
    return NextResponse.json({ data: [] });
  }
}
