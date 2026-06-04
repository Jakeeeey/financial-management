import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 1. Safely extract all possible query parameters sent by the React UI
    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status") || "ALL";
    const payeeId = url.searchParams.get("payeeId");
    const transactionType = url.searchParams.get("transactionType"); // 🚀 NEW

    // 2. Rebuild the query string for Spring Boot
    const springParams = new URLSearchParams();
    if (startDate) springParams.append("startDate", startDate);
    if (endDate) springParams.append("endDate", endDate);
    if (status) springParams.append("status", status);
    if (payeeId) springParams.append("payeeId", payeeId);
    if (transactionType) springParams.append("transactionType", transactionType); // 🚀 NEW
    // 3. 🚀 Point directly to the /v1/ Spring Boot Controller
    const targetUrl = `${getSpringBaseUrl()}/api/v1/treasury/disbursements/dashboard?${springParams.toString()}`;

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
        return NextResponse.json(data);

    } catch (err: unknown) {
        console.error("[BFF GET Disbursement Dashboard Error]:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}