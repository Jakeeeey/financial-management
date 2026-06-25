import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload } from "@/lib/auth-utils";
import { normalizeDisbursement, getLineItems, getUserMap, PayableInput, PaymentInput, resolveEncoderId, cleanSupportingDocsUrl, getCoaMap } from "../route";

export const runtime = "nodejs";

// 🚀 PUT Handler - Directus Native
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const id = Number(resolvedParams.id);

    const decoded = decodeJwtPayload(token);
    const encoderEmail = decoded?.email || decoded?.sub || null;
    const currentUserId = await resolveEncoderId(encoderEmail);

    try {
        const body = await request.json();

        // 1. Fetch current status from Directus
        const directusUrl = `${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement/${id}`;
        const directusToken = process.env.DIRECTUS_STATIC_TOKEN || "";

        const currentRes = await fetch(directusUrl, {
            headers: {
                Authorization: `Bearer ${directusToken}`,
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        if (!currentRes.ok) {
            return NextResponse.json({ message: "Disbursement not found" }, { status: 404 });
        }

        const currentDis = (await currentRes.json()).data;

        // Immutability Enforcement Check
        if (Number(currentDis.isPosted) === 1) {
            return NextResponse.json({ message: "Cannot modify a transaction that is already Posted to the GL. This record is immutable." }, { status: 400 });
        }

        if (currentDis.status !== "Draft" && currentDis.status !== "Approved" && currentDis.status !== "Returned for Revision") {
            return NextResponse.json({ message: "Only Draft, Approved, or Returned for Revision disbursements can be edited." }, { status: 400 });
        }

        // 2. Fetch existing payables & payments to clear them (matching Spring Boot's behavior)
        const payablesUrl = `${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement_payables?filter[disbursement_id][_eq]=${id}&fields=id`;
        const payablesRes = await fetch(payablesUrl, {
            headers: { Authorization: `Bearer ${directusToken}` },
            cache: "no-store",
        });
        const existingPayables = ((await payablesRes.json()).data || []) as { id: number }[];
        const payableIds = existingPayables.map((p) => p.id);

        const paymentsUrl = `${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement_payments?filter[disbursement_id][_eq]=${id}&fields=id`;
        const paymentsRes = await fetch(paymentsUrl, {
            headers: { Authorization: `Bearer ${directusToken}` },
            cache: "no-store",
        });
        const existingPayments = ((await paymentsRes.json()).data || []) as { id: number }[];
        const paymentIds = existingPayments.map((p) => p.id);

        // Delete existing line items
        if (payableIds.length > 0) {
            await fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement_payables`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${directusToken}`, "Content-Type": "application/json" },
                body: JSON.stringify(payableIds),
            });
        }
        if (paymentIds.length > 0) {
            await fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement_payments`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${directusToken}`, "Content-Type": "application/json" },
                body: JSON.stringify(paymentIds),
            });
        }

        // 3. Threshold check & status transition
        const APPROVAL_THRESHOLD = 1000.00;
        const isBelowThreshold = Number(body.totalAmount) < APPROVAL_THRESHOLD;
        let newStatus = currentDis.status;
        let approverId = currentDis.approver_id;
        let dateApproved = currentDis.date_approved;

        if (isBelowThreshold) {
            newStatus = "Approved";
            approverId = currentUserId;
            dateApproved = new Date().toISOString();
        } else if (currentDis.status === "Approved") {
            // Resubmit if it was approved and now edited to be over threshold
            newStatus = "Submitted";
            approverId = null;
            dateApproved = null;
        }

        // 4. Calculate paid amount (sum of payments)
        const calculatedPaidAmount = (body.payments || []).reduce(
            (sum: number, p: PaymentInput) => sum + (Number(p.amount) || 0),
            0
        );

        // 5. Update parent header (no nested O2M — Directus doesn't support it)
        const headerPayload = {
            transaction_type: body.transactionTypeId ? Number(body.transactionTypeId) : null,
            payee: Number(body.payeeId),
            remarks: body.remarks || "",
            total_amount: Number(body.totalAmount) || 0,
            paid_amount: calculatedPaidAmount,
            transaction_date: body.transactionDate,
            division_id: body.divisionId ? Number(body.divisionId) : null,
            department_id: body.departmentId ? Number(body.departmentId) : null,
            supporting_documents_url: cleanSupportingDocsUrl(body.supportingDocumentsUrl),
            status: newStatus,
            approver_id: approverId,
            date_approved: dateApproved,
        };

        const updateRes = await fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement/${id}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${directusToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(headerPayload),
        });
        if (!updateRes.ok) throw new Error(await updateRes.text());
        await updateRes.json();

        // 5b. Batch insert new line items
        const payableLines = (body.payables || [])
            .filter((line: PayableInput) => !!line.coaId || (line.amount != null && Number(line.amount) !== 0) || (line.referenceNo && line.referenceNo.trim() !== ""))
            .map((line: PayableInput) => ({
                disbursement_id: id,
                division_id: line.divisionId ? Number(line.divisionId) : null,
                reference_no: line.referenceNo || "",
                date: line.date,
                coa_id: line.coaId ? Number(line.coaId) : null,
                amount: Number(line.amount) || 0,
                remarks: line.remarks || ""
            }));

        const paymentLines = (body.payments || [])
            .filter((line: PaymentInput) => !!line.coaId || (line.amount != null && Number(line.amount) !== 0) || (line.checkNo && line.checkNo.trim() !== ""))
            .map((line: PaymentInput) => ({
                disbursement_id: id,
                coa_id: line.coaId ? Number(line.coaId) : null,
                bank_id: line.bankId ? Number(line.bankId) : null,
                check_no: line.checkNo || "",
                date: line.date,
                amount: Number(line.amount) || 0,
                remarks: line.remarks || "",
                released_by: line.releasedBy ? Number(line.releasedBy) : null,
                date_released: line.releasedDate || null
            }));

        const lineRes = await Promise.all([
            payableLines.length > 0
                ? fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement_payables`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${directusToken}`, "Content-Type": "application/json" },
                      body: JSON.stringify(payableLines),
                  })
                : Promise.resolve(),
            paymentLines.length > 0
                ? fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement_payments`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${directusToken}`, "Content-Type": "application/json" },
                      body: JSON.stringify(paymentLines),
                  })
                : Promise.resolve(),
        ]);

        for (const res of lineRes) {
            if (res && !res.ok) {
                throw new Error(await res.text());
            }
        }

        // 6. Fetch full line items structure, user maps, coa maps and map back to response DTO format
        const lineItems = await getLineItems([id]);
        const userMap = await getUserMap(token);
        const coaMap = await getCoaMap();

        // 7. Get fresh, fully-populated header details to normalize and return
        const fields = [
            "id",
            "doc_no",
            "transaction_type",
            "payee.id",
            "payee.supplier_name",
            "remarks",
            "total_amount",
            "paid_amount",
            "encoder_id",
            "submitted_by",
            "approver_id",
            "released_by",
            "posted_by",
            "isPosted",
            "transaction_date",
            "date_created",
            "date_submitted",
            "date_approved",
            "date_released",
            "date_posted",
            "division_id.division_id",
            "division_id.division_name",
            "department_id.department_id",
            "department_id.department_name",
            "fund_source_id",
            "supporting_documents_url",
            "status",
        ].join(",");
        
        const freshRes = await fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement/${id}?fields=${fields}`, {
            headers: {
                Authorization: `Bearer ${directusToken}`,
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        if (!freshRes.ok) throw new Error("Failed to fetch fresh disbursement header");
        const freshDis = (await freshRes.json()).data;

        return NextResponse.json(
            normalizeDisbursement(freshDis, lineItems.payables, lineItems.payments, userMap, coaMap)
        );

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}

// 🚀 DELETE Handler - Directus Native with Immutability Check
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const id = Number(resolvedParams.id);

    const decoded = decodeJwtPayload(token);
    const encoderEmail = decoded?.email || decoded?.sub || null;
    const currentUserId = await resolveEncoderId(encoderEmail);

    try {
        const directusToken = process.env.DIRECTUS_STATIC_TOKEN || "";
        const directusUrl = `${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement/${id}`;

        const currentRes = await fetch(directusUrl, {
            headers: { Authorization: `Bearer ${directusToken}` },
            cache: "no-store",
        });

        if (!currentRes.ok) {
            return NextResponse.json({ message: "Disbursement not found" }, { status: 404 });
        }

        const currentDis = (await currentRes.json()).data;

        // Immutability Enforcement Check
        if (Number(currentDis.isPosted) === 1) {
            return NextResponse.json({ message: "Cannot delete a transaction that is already Posted to the GL. This record is immutable." }, { status: 400 });
        }

        // Soft Delete: stamp is_deleted = 1, deleted_at = NOW(), and deleted_by = currentUserId
        const deletePayload = {
            is_deleted: 1,
            deleted_at: new Date().toISOString(),
            deleted_by: currentUserId,
            status: "Deleted"
        };

        const patchRes = await fetch(directusUrl, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${directusToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(deletePayload),
        });

        if (!patchRes.ok) throw new Error(await patchRes.text());

        return NextResponse.json({ message: "Disbursement soft-deleted successfully" });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}