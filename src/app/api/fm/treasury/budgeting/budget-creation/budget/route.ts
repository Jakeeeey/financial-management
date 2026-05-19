import { NextResponse } from "next/server";
// Triggering hot reload - File is clean of conflict markers.
import { cookies } from "next/headers";
import { jwtDecode } from "jwt-decode";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

// Helper to get user ID from JWT cookie
async function getUserId() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;
    if (!token) return null;
    try {
        const decoded = jwtDecode(token) as { sub?: string };
        return decoded.sub ? parseInt(decoded.sub) : null;
    } catch (e) {
        console.error("JWT Decode Error:", e);
        return null;
    }
}

// Helper to create audit log
async function createAuditLog(log: {
    budget_id: number;
    action: string;
    previous_status?: string | null;
    new_status: string;
    previous_amount?: number | null;
    new_amount: number;
    remarks?: string | null;
    performed_by: number | null;
}) {
    try {
        await fetch(`${API_BASE_URL}/items/budget_audit_trail`, {
            method: "POST",
            headers: AUTH_HEADERS,
            body: JSON.stringify(log),
        });
    } catch (e) {
        console.error("Audit Log Insertion Error:", e);
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    
    // Add global filter to exclude soft-deleted records
    const query = new URLSearchParams(searchParams);
    if (!query.has("filter[status][_neq]")) {
        query.append("filter[status][_neq]", "Deleted");
    }

    const targetUrl = `${API_BASE_URL}/items/budget?${query.toString()}`;

    try {
        const res = await fetch(targetUrl, {
            method: "GET",
            headers: AUTH_HEADERS,
            cache: "no-store",
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: "Directus Error" }));
            return NextResponse.json(error, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error("GET Budget Proxy Error:", err);
        return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const userId = await getUserId();
        
        const payload = {
            ...body,
            created_by: userId || body.created_by,
        };

        const res = await fetch(`${API_BASE_URL}/items/budget`, {
            method: "POST",
            headers: AUTH_HEADERS,
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: "Directus Error" }));
            return NextResponse.json(error, { status: res.status });
        }

        const result = await res.json();
        const createdBudget = result.data;

        // Log the creation
        if (createdBudget?.id) {
            await createAuditLog({
                budget_id: createdBudget.id,
                action: "Created",
                new_status: createdBudget.status || "Draft",
                new_amount: Number(createdBudget.amount),
                remarks: createdBudget.remarks,
                performed_by: userId,
            });
        }

        return NextResponse.json(result);
    } catch (err) {
        console.error("POST Budget Proxy Error:", err);
        return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
}

export async function PATCH(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = await getUserId();

    let targetUrl = `${API_BASE_URL}/items/budget`;
    if (id) targetUrl += `/${id}`;

    try {
        const body = await req.json();
        let payload: Record<string, unknown>;
        const isBulk = !!(body.keys && body.data);

        // Fetch old data for audit log
        const oldDataMap: Record<string, { status?: string; amount?: number | string }> = {};
        const idsToFetch = isBulk ? body.keys : (id ? [id] : []);
        
        if (idsToFetch.length > 0) {
            const filter = isBulk 
                ? `filter[id][_in]=${idsToFetch.join(",")}` 
                : `filter[id][_eq]=${id}`;
            
            const oldRes = await fetch(`${API_BASE_URL}/items/budget?${filter}&fields=id,status,amount`, {
                headers: AUTH_HEADERS
            });
            
            if (oldRes.ok) {
                const oldResult = await oldRes.json();
                const data = Array.isArray(oldResult.data) ? oldResult.data : [oldResult.data];
                data.forEach((item: { id?: string | number; status?: string; amount?: number | string }) => {
                    if (item) oldDataMap[String(item.id)] = item;
                });
            }
        }

        // Prepare payload
        if (isBulk) {
            payload = {
                keys: body.keys,
                data: {
                    ...body.data,
                    updated_by: userId || body.data.updated_by,
                },
            };
        } else {
            payload = {
                ...body,
                updated_by: userId || body.updated_by,
            };
        }

        const res = await fetch(targetUrl, {
            method: "PATCH",
            headers: AUTH_HEADERS,
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: "Directus Error" }));
            return NextResponse.json(error, { status: res.status });
        }

        const result = await res.json();
        const updatedBudgets = Array.isArray(result.data) ? result.data : [result.data];

        // Log the actions for each updated budget
        for (const budget of updatedBudgets) {
            if (!budget?.id) continue;
            
            const oldItem = oldDataMap[String(budget.id)];
            const targetStatus = isBulk ? body.data?.status : body.status;

            let action: string = "Submitted";
            if (targetStatus === "Pending") {
                action = (oldItem?.status === "Rejected") ? "Resubmitted" : "Submitted";
            } else if (targetStatus === "Approved") {
                action = "Approved";
            } else if (targetStatus === "Rejected") {
                action = "Rejected";
            } else if (targetStatus === "Deleted") {
                action = "Deleted";
            } else {
                // Map detail/amount updates to valid database action enums
                action = (oldItem?.status === "Rejected") ? "Resubmitted" : (oldItem?.status === "Draft" ? "Created" : "Submitted");
            }

            await createAuditLog({
                budget_id: budget.id,
                action: action,
                previous_status: oldItem?.status,
                new_status: budget.status || targetStatus || oldItem?.status || "Draft",
                previous_amount: oldItem ? Number(oldItem.amount) : undefined,
                new_amount: Number(budget.amount),
                remarks: (isBulk ? body.data?.remarks : body.remarks) || budget.remarks,
                performed_by: userId,
            });
        }

        return NextResponse.json(result);
    } catch (err) {
        console.error("PATCH Budget Proxy Error:", err);
        return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
}

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = await getUserId();

    if (!id) return NextResponse.json({ message: "ID is required" }, { status: 400 });

    try {
        // Implement SOFT DELETE
        const oldRes = await fetch(`${API_BASE_URL}/items/budget/${id}?fields=status,amount`, {
            headers: AUTH_HEADERS
        });
        const oldResult = await oldRes.json();
        const oldData = oldResult.data;

        // Perform soft delete
        const res = await fetch(`${API_BASE_URL}/items/budget/${id}`, {
            method: "PATCH",
            headers: AUTH_HEADERS,
            body: JSON.stringify({
                status: "Deleted",
                deleted_at: new Date().toISOString(),
                deleted_by: userId
            }),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: "Directus Error" }));
            return NextResponse.json(error, { status: res.status });
        }

        // Log the deletion
        await createAuditLog({
            budget_id: parseInt(id),
            action: "Deleted",
            previous_status: oldData?.status,
            new_status: "Deleted",
            previous_amount: Number(oldData?.amount),
            new_amount: Number(oldData?.amount),
            remarks: "Budget record soft-deleted.",
            performed_by: userId,
        });

        return new NextResponse(null, { status: 204 });
    } catch (err) {
        console.error("DELETE Budget Proxy Error:", err);
        return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
}
