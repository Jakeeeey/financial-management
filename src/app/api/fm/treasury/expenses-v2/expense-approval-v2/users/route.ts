import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET() {
  try {
    const fields = [
      "user_id",
      "user_fname",
      "user_lname",
      "user_email",
      "user_position",
      "user_department",
    ].join(",");

    const res = await fetch(`${API_BASE_URL}/items/user?fields=${fields}&sort=user_fname`, {
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
