import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    try {
        const springRes = await fetch(`${process.env.SPRING_API_BASE_URL}/api/v1/treasury/bank-deposits/${id}/clear`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({})
        });

        if (!springRes.ok) throw new Error(await springRes.text());
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        return NextResponse.json({ message }, { status: 500 });
    }
}