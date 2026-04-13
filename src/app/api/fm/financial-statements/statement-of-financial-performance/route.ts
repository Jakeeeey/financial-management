import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = "http://100.81.225.79:8086/api";
const COOKIE_NAME = "vos_access_token";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized: Missing vos_access_token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Default source modules if none are provided
    if (!searchParams.has("sourceModule")) {
      searchParams.append("sourceModule", "Sales");
      searchParams.append("sourceModule", "Disbursement");
      searchParams.append("sourceModule", "Collection");
    }

    if (!searchParams.has("status") || searchParams.get("status") === "") {
        searchParams.set("status", "Posted");
    }

    const backendUrl = `${API_BASE_URL}/income-statement?${searchParams.toString()}`;

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // cache: "no-store", // Next.js caches fetch by default; use no-store if needed. Let's use it for real-time reporting.
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Backend API responded with ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[IncomeStatement API Route] Error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
