import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

interface DashboardDisbursement {
    id: number;
    doc_no?: string;
    transaction_date?: string;
    date_created?: string;
    status?: string;
    total_amount?: number;
    paid_amount?: number;
    payee?: {
        id?: number;
        supplier_name?: string;
    };
    division_id?: {
        division_id?: number;
        division_name?: string;
    };
    payables?: Array<{
        amount?: number;
        coa_id?: {
            coa_id?: number;
            account_title?: string;
        };
    }>;
    payments?: Array<{
        amount?: number;
        check_no?: string;
        bank_id?: number;
        coa_id?: {
            coa_id?: number;
            account_title?: string;
        };
    }>;
}

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status") || "ALL";
    const payeeId = url.searchParams.get("payeeId");
    const transactionType = url.searchParams.get("transactionType");
    const encoderId = url.searchParams.get("encoderId");
    const coaId = url.searchParams.get("coaId");
    const amount = url.searchParams.get("amount");

    try {
        const filterAnd: Record<string, unknown>[] = [];
        if (startDate) filterAnd.push({ transaction_date: { _gte: startDate } });
        if (endDate) filterAnd.push({ transaction_date: { _lte: endDate } });
        if (status && status !== "ALL") filterAnd.push({ status: { _eq: status } });
        if (payeeId) filterAnd.push({ payee: { _eq: Number(payeeId) } });
        if (transactionType && transactionType !== "ALL") {
            const typeNum = Number(transactionType);
            if (!isNaN(typeNum)) {
                filterAnd.push({ transaction_type: { _eq: typeNum } });
            }
        }
        if (encoderId) filterAnd.push({ encoder_id: { _eq: Number(encoderId) } });
        if (amount) filterAnd.push({ total_amount: { _eq: Number(amount) } });

        if (coaId) {
            filterAnd.push({
                _or: [
                    { payables: { coa_id: { _eq: Number(coaId) } } },
                    { payments: { coa_id: { _eq: Number(coaId) } } }
                ]
            });
        }

        const queryParams = new URLSearchParams({
            limit: "-1",
            fields: [
                "id",
                "doc_no",
                "transaction_date",
                "status",
                "payee.id",
                "payee.supplier_name",
                "total_amount",
                "paid_amount",
                "division_id.division_id",
                "division_id.division_name",
                "payables.coa_id.coa_id",
                "payables.coa_id.account_title",
                "payables.amount",
                "payments.coa_id.coa_id",
                "payments.coa_id.account_title",
                "payments.amount",
                "payments.check_no",
                "payments.bank_id"
            ].join(",")
        });

        if (filterAnd.length > 0) {
            queryParams.set("filter", JSON.stringify({ _and: filterAnd }));
        }

        const directusRes = await fetch(`${DIRECTUS_URL}/items/disbursement?${queryParams.toString()}`, {
            headers: {
                Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            },
            cache: "no-store",
        });

        if (!directusRes.ok) throw new Error(await directusRes.text());
        const disbursements = ((await directusRes.json()).data || []) as DashboardDisbursement[];

        // 2. Perform aggregates in-memory
        let totalDisbursed = 0;
        let totalPaid = 0;

        const divisionMap = new Map<number, { name: string, amount: number }>();
        const coaMap = new Map<number, { title: string, amount: number }>();

        const vouchers = disbursements.map((d: DashboardDisbursement) => {
            const docAmt = Number(d.total_amount) || 0;
            const paidAmt = Number(d.paid_amount) || 0;

            totalDisbursed += docAmt;
            totalPaid += paidAmt;

            // Division expenses grouping
            const divId = d.division_id?.division_id || d.division_id;
            const divName = d.division_id?.division_name || "N/A";
            if (divId) {
                const idNum = Number(divId);
                const current = divisionMap.get(idNum) || { name: String(divName), amount: 0 };
                current.amount += docAmt;
                divisionMap.set(idNum, current);
            }

            // COA expenses grouping (from payables)
            const payables = d.payables || [];
            payables.forEach((p) => {
                const pCoaId = p.coa_id?.coa_id || p.coa_id;
                const title = p.coa_id?.account_title || "N/A";
                if (pCoaId) {
                    const idNum = Number(pCoaId);
                    const current = coaMap.get(idNum) || { title: String(title), amount: 0 };
                    current.amount += Number(p.amount) || 0;
                    coaMap.set(idNum, current);
                }
            });

            const payments = d.payments || [];
            const checkNumbers = Array.from(new Set(
                payments.map((p) => p.check_no).filter((c): c is string => Boolean(c && c.trim()))
            )).join(", ");

            const bankNames = Array.from(new Set(
                payments.map((p) => p.bank_id).filter(Boolean)
            )).map(b => `Bank #${b}`).join(", ");

            const expenseAccountsHit = Array.from(new Set(
                payables.map((p) => p.coa_id?.account_title).filter((t): t is string => Boolean(t && t.trim()))
            )).join(", ");

            return {
                id: d.id,
                docNo: d.doc_no || "",
                transactionDate: d.transaction_date || "",
                status: d.status || "Draft",
                payeeName: d.payee?.supplier_name || "",
                totalAmount: docAmt,
                paidAmount: paidAmt,
                checkNumbers,
                bankNames,
                expenseAccountsHit
            };
        });

        const divisionExpenses = Array.from(divisionMap.entries()).map(([id, data]) => ({
            divisionId: id,
            divisionName: data.name,
            totalExpense: Math.round(data.amount * 100) / 100
        }));

        const coaExpenses = Array.from(coaMap.entries()).map(([id, data]) => ({
            coaId: id,
            accountTitle: data.title,
            totalExpense: Math.round(data.amount * 100) / 100
        }));

        return NextResponse.json({
            totalDisbursed: Math.round(totalDisbursed * 100) / 100,
            totalPaid: Math.round(totalPaid * 100) / 100,
            totalUnpaidPayables: Math.round((totalDisbursed - totalPaid) * 100) / 100,
            divisionExpenses,
            coaExpenses,
            vouchers
        });

    } catch (err: unknown) {
        console.error("[BFF GET Disbursement Dashboard Error]:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}