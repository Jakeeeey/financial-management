import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

interface DirectusPurchaseOrder {
    purchase_order_id: number;
    purchase_order_no: string;
    date?: string | null;
    payment_type?: number;
    payment_status?: number;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const supplierId = Number(resolvedParams.supplierId);

    try {
        const queryParams = new URLSearchParams({
            filter: JSON.stringify({
                _and: [
                    { supplier_name: { _eq: supplierId } },
                    { payment_status: { _in: [1, 2, 3] } }
                ]
            }),
            fields: [
                "purchase_order_id",
                "purchase_order_no",
                "date",
                "payment_type",
                "payment_status"
            ].join(","),
            limit: "-1"
        });

        const directusRes = await fetch(`${DIRECTUS_URL}/items/purchase_order?${queryParams.toString()}`, {
            headers: {
                Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            },
            cache: "no-store",
        });

        if (!directusRes.ok) throw new Error(await directusRes.text());
        const poList = ((await directusRes.json()).data || []) as DirectusPurchaseOrder[];

        if (poList.length === 0) {
            return NextResponse.json([]);
        }

        // Fetch active disbursements for this supplier (to avoid 403 relational filter issue)
        const disRes = await fetch(`${DIRECTUS_URL}/items/disbursement?filter[payee][_eq]=${supplierId}&filter[status][_in]=Draft,Submitted,Approved,Released,Posted&fields=id&limit=-1`, {
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            cache: "no-store",
        });
        const disList = disRes.ok ? (((await disRes.json()).data || []) as Array<{ id: number }>) : [];
        const disIdsForPaid = disList.map(d => d.id);

        const paidPayablesList: Array<{ reference_no?: string; amount?: number }> = [];
        if (disIdsForPaid.length > 0) {
            const paidPayablesParams = new URLSearchParams();
            paidPayablesParams.set("filter[disbursement_id][_in]", disIdsForPaid.join(","));
            paidPayablesParams.set("fields", "reference_no,amount");
            paidPayablesParams.set("limit", "-1");

            const paidPayablesRes = await fetch(`${DIRECTUS_URL}/items/disbursement_payables?${paidPayablesParams.toString()}`, {
                headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
                cache: "no-store",
            });
            if (paidPayablesRes.ok) {
                const json = await paidPayablesRes.json();
                paidPayablesList.push(...(json.data || []));
            }
        }

        const paidMap: Record<string, number> = {};
        for (const p of paidPayablesList) {
            const ref = (p.reference_no || "").trim();
            const amt = Number(p.amount) || 0;
            if (ref) {
                paidMap[ref] = (paidMap[ref] || 0) + amt;
            }
        }

        const poIds = poList.map(po => po.purchase_order_id);

        // Fetch products and receivings in parallel
        const productsUrl = `${DIRECTUS_URL}/items/purchase_order_products?limit=-1&filter=${encodeURIComponent(
            JSON.stringify({ purchase_order_id: { _in: poIds } })
        )}&fields=purchase_order_id,total_amount,ordered_quantity,unit_price`;

        const receivingsUrl = `${DIRECTUS_URL}/items/purchase_order_receiving?limit=-1&filter=${encodeURIComponent(
            JSON.stringify({ purchase_order_id: { _in: poIds } })
        )}&fields=purchase_order_id,receipt_no,receipt_date,total_amount,received_quantity,unit_price`;

        const [productsRes, receivingsRes] = await Promise.all([
            fetch(productsUrl, {
                headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
                cache: "no-store",
            }),
            fetch(receivingsUrl, {
                headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
                cache: "no-store",
            })
        ]);

        if (!productsRes.ok) throw new Error(await productsRes.text());
        if (!receivingsRes.ok) throw new Error(await receivingsRes.text());

        const productsData = (await productsRes.json()).data || [];
        const receivingsData = (await receivingsRes.json()).data || [];

        const productsByPoId: Record<number, Array<{ total_amount?: string | number | null; ordered_quantity?: number; unit_price?: string | number }>> = {};
        for (const p of productsData) {
            const poId = Number(p.purchase_order_id);
            if (!productsByPoId[poId]) productsByPoId[poId] = [];
            productsByPoId[poId].push(p);
        }

        const receivingsByPoId: Record<number, Array<{ receipt_no?: string; receipt_date?: string | null; total_amount?: string | number | null; received_quantity?: number; unit_price?: string | number }>> = {};
        for (const r of receivingsData) {
            const poId = Number(r.purchase_order_id);
            if (!receivingsByPoId[poId]) receivingsByPoId[poId] = [];
            receivingsByPoId[poId].push(r);
        }

        const unpaidPos: Array<{
            uniqueKey: string;
            poId: number;
            poNo: string;
            receiptNo: string;
            date: string | null;
            amountDue: number;
            type: string;
        }> = [];

        for (const po of poList) {
            const poId = po.purchase_order_id;
            const poNo = po.purchase_order_no;

            if (Number(po.payment_type) === 1) {
                // CWO (Cash With Order)
                const products = productsByPoId[poId] || [];
                const totalLiability = products.reduce((sum: number, p) => {
                    const amt = p.total_amount !== null && p.total_amount !== undefined
                        ? Number(p.total_amount)
                        : (Number(p.ordered_quantity || 0) * Number(p.unit_price || 0));
                    return sum + (amt || 0);
                }, 0);

                const refKey = `${poNo} / ADVANCE-CWO`;
                const alreadyPaid = paidMap[refKey] || 0;
                const remainingDue = Math.max(0, totalLiability - alreadyPaid);

                if (remainingDue > 0.01) {
                    unpaidPos.push({
                        uniqueKey: `${poNo}-ADVANCE-CWO`,
                        poId,
                        poNo,
                        receiptNo: "ADVANCE-CWO",
                        date: po.date ? po.date.split("T")[0] : null,
                        amountDue: Number(remainingDue.toFixed(2)),
                        type: "CWO"
                    });
                }
            } else {
                // Non-CWO (RECEIPT)
                const receivings = receivingsByPoId[poId] || [];
                const grouped: Record<string, { transDate: string | null, totalLiability: number }> = {};

                for (const por of receivings) {
                    const rNo = por.receipt_no || "NO-RECEIPT";
                    if (!grouped[rNo]) {
                        grouped[rNo] = { transDate: null, totalLiability: 0 };
                    }
                    const amt = por.total_amount !== null && por.total_amount !== undefined
                        ? Number(por.total_amount)
                        : (Number(por.received_quantity || 0) * Number(por.unit_price || 0));
                    grouped[rNo].totalLiability += amt || 0;

                    const currentDateStr = por.receipt_date || null;
                    if (currentDateStr) {
                        if (!grouped[rNo].transDate || new Date(currentDateStr) > new Date(grouped[rNo].transDate!)) {
                            grouped[rNo].transDate = currentDateStr.split("T")[0];
                        }
                    }
                }

                for (const [receiptNo, data] of Object.entries(grouped)) {
                    const refKey = `${poNo} / ${receiptNo}`;
                    const alreadyPaid = paidMap[refKey] || 0;
                    const remainingDue = Math.max(0, data.totalLiability - alreadyPaid);

                    if (remainingDue > 0.01) {
                        unpaidPos.push({
                            uniqueKey: `${poNo}-${receiptNo}`,
                            poId,
                            poNo,
                            receiptNo,
                            date: data.transDate || null,
                            amountDue: Number(remainingDue.toFixed(2)),
                            type: "RECEIPT"
                        });
                    }
                }
            }
        }

        return NextResponse.json(unpaidPos);

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}