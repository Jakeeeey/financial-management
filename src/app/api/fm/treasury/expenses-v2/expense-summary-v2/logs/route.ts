import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const expenseId = searchParams.get("expense_id");

    if (!expenseId) {
      return NextResponse.json({ error: "expense_id is required" }, { status: 400 });
    }

    const fields = [
      "id",
      "expense_id",
      "action",
      "remarks",
      "receipt_url",
      "created_at",
      "created_by.user_id",
      "created_by.user_fname",
      "created_by.user_lname",
      "created_by.user_email",
    ].join(",");

    const url = `${API_BASE_URL}/items/expense_logs?fields=${fields}&filter[expense_id][_eq]=${expenseId}&sort=created_at`;

    const res = await fetch(url, {
      headers: AUTH_HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ data: data.data || [] });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
