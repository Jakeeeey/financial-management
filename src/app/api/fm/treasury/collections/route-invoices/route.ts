import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const {searchParams} = new URL(request.url);
    const salesmanId = searchParams.get("salesmanId");
    const date = searchParams.get("date");

    if (!salesmanId || !date) {
        return NextResponse.json({message: "Missing salesmanId or date"}, {status: 400});
    }

    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/route-invoices?salesmanId=${salesmanId}&date=${date}`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            cache: "no-store", // Crucial for live search!
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            console.error(`[Spring Boot GET Error] Status: ${springRes.status}, Body:`, errorText);
            throw new Error(errorText || `Spring GET Error: ${springRes.status}`);
        }

        const data = await springRes.json();

        return NextResponse.json(data);

    } catch (err: unknown) {
        console.error("[BFF GET Route Invoices Exception]:", err);
        return NextResponse.json({
            message: "BFF Error fetching route invoices",
            detail: (err instanceof Error ? err.message : String(err))
        }, {status: 502});
    }
}