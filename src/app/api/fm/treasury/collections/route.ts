import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Interface for raw API response from Spring Boot
interface CollectionRawResponse {
    id: number;
    docNo?: string;
    collectionDate: string;
    salesman?: {
        salesmanCode: string;
        salesmanName: string;
    };
    totalAmount?: number;
}

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    // 🚀 Points to your Spring Boot CollectionController
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/unposted`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            cache: "no-store",
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            throw new Error(errorText || `Spring GET Error: ${springRes.status}`);
        }

        const data = await springRes.json();

        // 🚀 FIXED: Correctly closed the map function and mapped to CollectionSummary interface
        const mappedData = data.map((col: CollectionRawResponse) => ({
            id: col.id,
            docNo: col.docNo, // Fallback just in case
            date: col.collectionDate,
            salesmanCode: col.salesman?.salesmanCode || "N/A",
            salesmanName: col.salesman?.salesmanName || "Unknown",
            amount: col.totalAmount || 0,
            status: "Draft" // Unposted collections are Drafts
        }));

        return NextResponse.json(mappedData);
    } catch (err: unknown) {
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/receive`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
        });

        // 🚀 FIXED: Added robust error logging to catch the "Silent 502"
        if (!springRes.ok) {
            const errorText = await springRes.text();
            console.error(`[Spring Boot POST Error] Status: ${springRes.status}, Body:`, errorText);
            throw new Error(errorText || `Spring Boot rejected with status: ${springRes.status}`);
        }

        // Backend returns raw string DocNo (e.g., "CP-000001")
        const result = await springRes.text();
        return new NextResponse(result, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch (err: unknown) {
        console.error("[BFF POST Exception]:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}