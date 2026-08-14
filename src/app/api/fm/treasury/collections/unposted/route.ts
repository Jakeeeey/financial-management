import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getSpringBaseUrl = () =>
    (process.env.SPRING_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");

interface CollectionRawResponse {
    id: number;
    docNo?: string;
    date?: string;
    encodedDate?: string;
    collectedByName?: string;
    salesmanCode?: string;
    salesmanName?: string;
    totalAmount?: number;
    appliedAmount?: number;
}

interface PaginatedCollectionRawResponse {
    content: CollectionRawResponse[];
    totalElements: number;
    totalPages: number;
    currentPage: number;
}

export async function GET(request: NextRequest) {
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const queryString = new URL(request.url).searchParams.toString();
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/unposted/paged${queryString ? `?${queryString}` : ""}`;

    try {
        const springResponse = await fetch(targetUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        const body = await springResponse.text();
        if (!springResponse.ok) {
            return NextResponse.json(
                {message: body || `Spring GET Error: ${springResponse.status}`},
                {status: springResponse.status}
            );
        }

        const data = JSON.parse(body) as PaginatedCollectionRawResponse;
        const mappedData = {
            ...data,
            content: (data.content || []).map(collection => ({
                id: collection.id,
                docNo: collection.docNo || "",
                date: collection.date || "",
                encodedDate: collection.encodedDate || "",
                collectedBy: collection.collectedByName || "N/A",
                salesmanCode: collection.salesmanCode || "N/A",
                salesmanName: collection.salesmanName || "Unknown",
                amount: collection.totalAmount || 0,
                appliedAmount: collection.appliedAmount || 0,
                status: "Draft",
            })),
        };

        return NextResponse.json(mappedData, {
            status: 200,
        });
    } catch (error) {
        return NextResponse.json({
            message: "BFF Error",
            detail: error instanceof Error ? error.message : String(error),
        }, {status: 502});
    }
}
