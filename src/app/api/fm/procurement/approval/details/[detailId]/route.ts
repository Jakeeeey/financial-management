import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

// Line items are read-only after request creation: all mutating verbs are locked.
// Response envelopes ({ message } / { success }) are unchanged; only the verbs are gated.
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ message: "Line items are read-only after request creation" }, { status: 403 });
}

export async function PATCH() {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ message: "Line items are read-only after request creation" }, { status: 403 });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ message: "Line items are read-only after request creation" }, { status: 403 });
}
