import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const res = await fetch(`${API_BASE_URL}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STATIC_TOKEN}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "File upload failed" }));
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("POST Files Error:", err);
    return NextResponse.json(
      { message: "File proxy error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
