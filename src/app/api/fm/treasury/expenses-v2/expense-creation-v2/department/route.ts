import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/items/department?limit=-1`, {
      headers: AUTH_HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ data: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET Department Error:", err);
    return NextResponse.json({ data: [] });
  }
}
