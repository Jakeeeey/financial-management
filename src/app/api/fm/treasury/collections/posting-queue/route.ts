import {  NextResponse } from "next/server";
import { cookies } from "next/headers";


interface RawPostingQueueItem {
    id: number;
    docNo: string;
    collectionDate: string;
    salesmanName?: string;
    operationName?: string;
    encoderName?: string;
    collectorName?: string;
    pouchAmount?: number;
    totalAppliedAmount?: number;
    creditAppliedAmount?: number;
    adjustmentDebit?: number;
    adjustmentCredit?: number;
    remarks?: string;
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

    // 🚀 Points to the dedicated Posting Queue endpoint in Spring Boot
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/posting-queue`;

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
            console.error(`[Spring Posting Queue Error] Status: ${springRes.status}`, errorText);
            throw new Error(errorText || `Spring GET Error: ${springRes.status}`);
        }

        const data: RawPostingQueueItem[] = await springRes.json();

        /**
         * 🚀 MAPPING LOGIC
         * Maps the raw response from our 12-column Native Query
         * straight into the PostingQueueItem interface the UI expects.
         */
        const mappedData = data.map((col: RawPostingQueueItem) => ({
            id: col.id,
            docNo: col.docNo,
            collectionDate: col.collectionDate,
            salesmanName: col.salesmanName || "Unknown Route",
            operationName: col.operationName || "Unassigned Operation",
            encoderName: col.encoderName || "Cashier",
            collectorName: col.collectorName || "N/A",
            pouchAmount: col.pouchAmount || 0,
            totalAppliedAmount: col.totalAppliedAmount || 0,
            creditAppliedAmount: col.creditAppliedAmount || 0,
            adjustmentDebit: col.adjustmentDebit || 0,   // Shortages
            adjustmentCredit: col.adjustmentCredit || 0, // Overages
            remarks: col.remarks || ""
        }));

        return NextResponse.json(mappedData);
    } catch (err: unknown) {
        console.error("[BFF Posting Queue Exception]:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}
