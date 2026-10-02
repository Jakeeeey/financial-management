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

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized / No valid user session found." },
        { status: 401 }
      );
    }

    let supplierId: number | null = null;
    let supplierName: string | null = null;
    let divisionId: number | null = null;
    let divisionName: string | null = null;

    // 1. Check suppliers where user_id = userId
    try {
      const suppRes = await fetch(
        `${API_BASE_URL}/items/suppliers?filter[user_id][_eq]=${userId}&limit=1`,
        { headers: AUTH_HEADERS, cache: "no-store" }
      );
      if (suppRes.ok) {
        const suppJson = await suppRes.json();
        if (suppJson.data && suppJson.data.length > 0) {
          const supp = suppJson.data[0];
          supplierId = Number(supp.id);
          supplierName = supp.supplier_name || null;
          if (supp.division_id) {
            divisionId = Number(supp.division_id);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching supplier by user_id:", e);
    }

    let isSalesman = false;
    let salesmanId: number | null = null;
    let salesmanName: string | null = null;
    let salesmanCode: string | null = null;

    // 2. Check salesman where encoder_id = userId OR employee_id = userId for division_id
    try {
      const salesRes = await fetch(
        `${API_BASE_URL}/items/salesman?filter[_or][0][encoder_id][_eq]=${userId}&filter[_or][1][employee_id][_eq]=${userId}&limit=1`,
        { headers: AUTH_HEADERS, cache: "no-store" }
      );
      if (salesRes.ok) {
        const salesJson = await salesRes.json();
        if (salesJson.data && salesJson.data.length > 0) {
          const salesman = salesJson.data[0];
          isSalesman = true;
          salesmanId = Number(salesman.id);
          salesmanName = salesman.salesman_name || null;
          salesmanCode = salesman.salesman_code || null;
          if (salesman.division_id) {
            divisionId = Number(salesman.division_id);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching salesman by user_id:", e);
    }

    // 3. Resolve division_name from division table if divisionId is found
    if (divisionId) {
      try {
        const divRes = await fetch(
          `${API_BASE_URL}/items/division/${divisionId}`,
          { headers: AUTH_HEADERS, cache: "no-store" }
        );
        if (divRes.ok) {
          const divJson = await divRes.json();
          divisionName = divJson.data?.division_name || null;
        }
      } catch (e) {
        console.error("Error fetching division details:", e);
      }
    }

    return NextResponse.json({
      data: {
        user_id: userId,
        supplier_id: supplierId,
        supplier_name: supplierName,
        division_id: divisionId,
        division_name: divisionName,
        is_employee: true,
        is_salesman: isSalesman,
        salesman_id: salesmanId,
        salesman_name: salesmanName,
        salesman_code: salesmanCode,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to resolve user defaults.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
