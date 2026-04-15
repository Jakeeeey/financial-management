import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

// Use the helper that matches your project's naming convention
const getSpringBaseUrl = () => {
    // 🚀 Fixed: Using the correct Env Var name from your other routes
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();

        // 🚀 This will now be "http://localhost:8080/api/v1/collections/receive"
        const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/receive`;

        const springRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json" // 🚀 Fixed: Removed the trailing "{" syntax error
            },
            body: JSON.stringify(body),
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            throw new Error(errorText);
        }

        const result = await springRes.text();

        // Return as plain text for the fetchProvider
        return new Response(result, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (err: unknown) {
        // 🚀 This logs the error to your VS Code terminal so you can see it!
        console.error("[BFF] POST /api/fm/treasury/collections/receive failed:", err);

        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}