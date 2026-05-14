import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const pouchId = id;

    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/${pouchId}/post`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({}),
            cache: "no-store",
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            console.error(`[Spring POST Post-Pouch Error] Status: ${springRes.status}`, errorText);
            throw new Error(errorText || `Spring POST Error: ${springRes.status}`);
        }

        const textResponse = await springRes.text();
        let data;

        // 🚀 THE FIX: Safely try to parse JSON. If it's plain text, catch the error and wrap it!
        try {
            data = textResponse ? JSON.parse(textResponse) : { success: true };
        } catch {
            data = { success: true, message: textResponse };
        }

        return NextResponse.json(data);

    } catch (err: unknown) {
        console.error(`[BFF POST Post-Pouch Exception for ID ${pouchId}]:`, err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}