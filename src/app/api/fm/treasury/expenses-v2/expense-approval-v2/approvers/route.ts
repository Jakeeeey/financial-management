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

// GET: Fetch all active approvers (is_deleted = 0) with user and division relations
export async function GET() {
  try {
    const fields = [
      "id",
      "approver_hierarchy",
      "is_deleted",
      "created_at",
      "created_by.user_id",
      "created_by.user_fname",
      "created_by.user_lname",
      "approver_id.user_id",
      "approver_id.user_fname",
      "approver_id.user_lname",
      "approver_id.user_email",
      "approver_id.user_position",
      "division_id.division_id",
      "division_id.division_name",
      "division_id.division_code",
    ].join(",");

    const res = await fetch(
      `${API_BASE_URL}/items/expense_approvers?fields=${fields}&filter[is_deleted][_eq]=false&sort=division_id,approver_hierarchy`,
      {
        headers: AUTH_HEADERS,
        cache: "no-store",
      }
    );

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

// POST: Add new expense approver
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();

    const { approver_id, division_id, approver_hierarchy, created_at } = body;

    // Validation: hierarchy must be an integer > 0 (no zero, no negative)
    const hierarchyNum = Number(approver_hierarchy);
    if (!Number.isInteger(hierarchyNum) || hierarchyNum <= 0) {
      return NextResponse.json(
        { error: "Approver hierarchy must be a positive integer greater than 0." },
        { status: 400 }
      );
    }

    if (!approver_id || !division_id) {
      return NextResponse.json(
        { error: "Approver user and Division are required." },
        { status: 400 }
      );
    }

    // Check for existing duplicate active approver in same division with same hierarchy level
    const checkRes = await fetch(
      `${API_BASE_URL}/items/expense_approvers?filter[division_id][_eq]=${division_id}&filter[approver_hierarchy][_eq]=${hierarchyNum}&filter[is_deleted][_eq]=false`,
      { headers: AUTH_HEADERS, cache: "no-store" }
    );

    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData.data && checkData.data.length > 0) {
        return NextResponse.json(
          { error: `Hierarchy Level ${hierarchyNum} already exists for this Division.` },
          { status: 400 }
        );
      }
    }

    const payload = {
      approver_id,
      division_id,
      approver_hierarchy: hierarchyNum,
      is_deleted: false,
      created_by: userId,
      created_at: created_at || new Date().toISOString(), // Literal PH timestamp
    };

    const createRes = await fetch(`${API_BASE_URL}/items/expense_approvers`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return NextResponse.json({ error: errText }, { status: createRes.status });
    }

    const createdData = await createRes.json();
    return NextResponse.json({ data: createdData.data });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}

// DELETE: Soft delete expense approver
export async function DELETE(req: Request) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const deleted_at_param = searchParams.get("deleted_at");

    if (!id) {
      return NextResponse.json({ error: "Approver record ID is required." }, { status: 400 });
    }

    const payload = {
      is_deleted: true,
      deleted_by: userId,
      deleted_at: deleted_at_param || new Date().toISOString(), // Literal PH timestamp
    };

    const updateRes = await fetch(`${API_BASE_URL}/items/expense_approvers/${id}`, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify(payload),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return NextResponse.json({ error: errText }, { status: updateRes.status });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
