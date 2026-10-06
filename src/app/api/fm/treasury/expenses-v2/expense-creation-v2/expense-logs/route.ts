import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtDecode } from "jwt-decode";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

async function getUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return null;
  try {
    const decoded = jwtDecode(token) as { sub?: string };
    return decoded.sub ? parseInt(decoded.sub, 10) : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const expenseId = searchParams.get("expense_id");

  if (!expenseId) {
    return NextResponse.json({ message: "expense_id param is required" }, { status: 400 });
  }

  const targetUrl = `${API_BASE_URL}/items/expense_logs?filter[expense_id][_eq]=${expenseId}&sort=-id&fields=*,created_by.user_id,created_by.user_fname,created_by.user_lname,created_by.user_email`;

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: AUTH_HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Directus Error" }));
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET Expense Logs Error:", err);
    return NextResponse.json(
      { message: "BFF Error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = await getUserId();

    const payload = {
      ...body,
      created_by: userId || body.created_by || null,
    };

    const res = await fetch(`${API_BASE_URL}/items/expense_logs`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Directus Error" }));
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("POST Expense Log Error:", err);
    return NextResponse.json(
      { message: "BFF Error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
