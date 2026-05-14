import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface SettlementQueueDto {
    id: number;
    docNo: string;
    collectionDate: string;
    salesmanName?: string;
    operationName?: string;
    collectorName?: string;
    encoderName?: string;
    pouchAmount?: number;
    adjustments?: number;
    receivableAmount?: number;
    discrepancy?: number;
    remarks?: string;
    status?: string;
}

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 🚀 Points to the new DTO-powered endpoint in Spring Boot
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/settlement-queue`;

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
            console.error(`[Spring Queue Error] Status: ${springRes.status}`, errorText);
            throw new Error(errorText || `Spring GET Error: ${springRes.status}`);
        }

        const data: SettlementQueueDto[] = await springRes.json();

        /**
         * 🚀 MAPPING LOGIC
         * We map directly from SettlementQueueDto.
         * No heavy lifting here; Spring already calculated the discrepancy!
         */
        const mappedData = data.map((col: SettlementQueueDto) => ({
            id: col.id,
            docNo: col.docNo,
            date: col.collectionDate,
            salesmanName: col.salesmanName || "Unknown Owner",
            operationName: col.operationName || "Unassigned Operation",
            collectorName: col.collectorName || "N/A",
            encoderName: col.encoderName || "System",
            pouchAmount: col.pouchAmount || 0,
            adjustments: col.adjustments || 0,
            receivableAmount: col.receivableAmount || 0,
            discrepancy: col.discrepancy || 0,
            remarks: col.remarks || "",
            status: col.status || "Pending"
        }));

        return NextResponse.json(mappedData);
    } catch (err: unknown) {
        console.error("[BFF Settlement Queue Exception]:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}