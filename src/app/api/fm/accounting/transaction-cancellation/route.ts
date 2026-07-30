import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import {
  CANCELLATION_ATTACHMENTS_COLLECTION,
  CANCELLATION_REQUESTS_COLLECTION,
  DirectusCancellationAttachment,
  DirectusCancellationRequest,
  deleteDirectusFile,
  deleteDirectusRecord,
  directusFetch,
  uploadDirectusFile,
  UploadedDirectusFile,
} from "./_attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DirectusSalesInvoice {
  invoice_id: number;
  invoice_no: string;
  customer_code: string | null;
  invoice_date: string | null;
  due_date: string | null;
  gross_amount: number | null;
  discount_amount: number | null;
  payment_status: string | null;
  transaction_status: string | null;
  isPosted: unknown;
  remarks: string | null;
}

interface CancellationAttachmentResponse {
  id: string | number;
  fileId: string;
  filename: string;
  mimeType: string;
  fileSize: number | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

interface CancellationRequestLookup {
  id: string | number;
  invoiceId: number;
  reason: string;
  previousStatus: string | null;
  status: string;
  requestedBy: string | null;
  requestedAt: string | null;
  attachments: CancellationAttachmentResponse[];
}

interface DirectusCustomer {
  customer_code: string;
  customer_name: string;
}

interface DirectusListResponse<T> {
  data?: T[];
  meta?: {
    filter_count?: number;
  };
}

function parseBit(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) return obj.data[0] === 1;
  }
  return val === '1' || val === 1;
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function" && typeof value.name === "string";
}

function mapAttachment(attachment: DirectusCancellationAttachment): CancellationAttachmentResponse {
  return {
    id: attachment.id,
    fileId: attachment.file_id,
    filename: attachment.filename,
    mimeType: attachment.mime_type,
    fileSize: attachment.file_size,
    uploadedBy: attachment.uploaded_by,
    uploadedAt: attachment.uploaded_at,
  };
}

async function getCancellationLookups(invoiceIds: number[]): Promise<Map<number, CancellationRequestLookup>> {
  const lookup = new Map<number, CancellationRequestLookup>();
  if (invoiceIds.length === 0) return lookup;

  try {
    const invoiceFilter = encodeURIComponent(invoiceIds.join(","));
    const requestsResponse = await directusFetch<{ data?: DirectusCancellationRequest[] }>(
      `/items/${CANCELLATION_REQUESTS_COLLECTION}?filter[invoice_id][_in]=${invoiceFilter}&filter[status][_eq]=PENDING&fields=id,invoice_id,reason,previous_status,status,requested_by,requested_at&limit=-1`
    );
    const requests = requestsResponse.data || [];
    if (requests.length === 0) return lookup;

    const requestIds = encodeURIComponent(requests.map((item) => String(item.id)).join(","));
    const attachmentsResponse = await directusFetch<{ data?: DirectusCancellationAttachment[] }>(
      `/items/${CANCELLATION_ATTACHMENTS_COLLECTION}?filter[cancellation_request_id][_in]=${requestIds}&fields=id,cancellation_request_id,file_id,filename,mime_type,file_size,uploaded_by,uploaded_at&limit=-1`
    );
    const attachmentsByRequest = new Map<string, CancellationAttachmentResponse[]>();
    for (const attachment of attachmentsResponse.data || []) {
      const key = String(attachment.cancellation_request_id);
      const current = attachmentsByRequest.get(key) || [];
      current.push(mapAttachment(attachment));
      attachmentsByRequest.set(key, current);
    }

    for (const request of requests) {
      lookup.set(Number(request.invoice_id), {
        id: request.id,
        invoiceId: Number(request.invoice_id),
        reason: request.reason,
        previousStatus: request.previous_status,
        status: request.status,
        requestedBy: request.requested_by,
        requestedAt: request.requested_at,
        attachments: attachmentsByRequest.get(String(request.id)) || [],
      });
    }
  } catch (error) {
    // Keep legacy invoice-remark requests visible if the optional attachment collections are unavailable.
    console.error("[Transaction Cancellation Attachments Lookup Error]:", error);
  }

  return lookup;
}

async function cleanupCreatedCancellationData(
  requestId: string | number | null,
  attachmentIds: Array<string | number>,
  uploadedFiles: UploadedDirectusFile[]
): Promise<void> {
  for (const attachmentId of attachmentIds) {
    await deleteDirectusRecord(CANCELLATION_ATTACHMENTS_COLLECTION, attachmentId).catch(() => undefined);
  }
  for (const file of uploadedFiles) {
    await deleteDirectusFile(file.id).catch(() => undefined);
  }
  if (requestId !== null) {
    await deleteDirectusRecord(CANCELLATION_REQUESTS_COLLECTION, requestId).catch(() => undefined);
  }
}

async function getPendingCancellationRequest(
  invoiceId: number,
  requestId: string | null
): Promise<DirectusCancellationRequest | null> {
  try {
    const query = requestId
      ? `/items/${CANCELLATION_REQUESTS_COLLECTION}/${encodeURIComponent(requestId)}?fields=id,invoice_id,reason,previous_status,status,requested_by,requested_at`
      : `/items/${CANCELLATION_REQUESTS_COLLECTION}?filter[invoice_id][_eq]=${invoiceId}&filter[status][_eq]=PENDING&fields=id,invoice_id,reason,previous_status,status,requested_by,requested_at&limit=1`;
    const response = await directusFetch<{ data?: DirectusCancellationRequest | DirectusCancellationRequest[] }>(query);
    const request = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!request || Number(request.invoice_id) !== invoiceId || request.status.toUpperCase() !== "PENDING") return null;
    return request;
  } catch (error) {
    if (requestId) throw error;
    console.error("[Pending Cancellation Request Lookup Error]:", error);
    return null;
  }
}

async function updateInvoiceAndRequest(
  invoiceId: number,
  invoicePatch: Record<string, unknown>,
  request: DirectusCancellationRequest | null,
  requestPatch: Record<string, unknown>,
  rollbackPatch: Record<string, unknown>
): Promise<void> {
  let invoiceUpdated = false;
  try {
    await directusFetch<{ data: DirectusSalesInvoice }>(
      `/items/sales_invoice/${invoiceId}`,
      { method: "PATCH", body: JSON.stringify(invoicePatch) }
    );
    invoiceUpdated = true;

    if (request) {
      await directusFetch<{ data: DirectusCancellationRequest }>(
        `/items/${CANCELLATION_REQUESTS_COLLECTION}/${encodeURIComponent(String(request.id))}`,
        { method: "PATCH", body: JSON.stringify(requestPatch) }
      );
    }
  } catch (error) {
    if (invoiceUpdated) {
      await directusFetch<{ data: DirectusSalesInvoice }>(
        `/items/sales_invoice/${invoiceId}`,
        { method: "PATCH", body: JSON.stringify(rollbackPatch) }
      ).catch(() => undefined);
    }
    throw error;
  }
}

// ── GET: List eligible invoices to cancel or pending requests ──────────
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = decodeJwtPayload(token);
  const userRole = payload?.role || "USER";
  const username = [payload?.FirstName, payload?.LastName].filter(Boolean).join(" ") || payload?.email || "User";

  const { searchParams } = new URL(request.url);
  const searchTerm = (searchParams.get("query") || "").trim();
  const statusTab = searchParams.get("status") || "active"; // "active" or "pending"
  
  // Pagination parameters
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));

  try {
    let filter = "";
    if (statusTab === "pending") {
      // Pending requests and unposted
      filter = 
        `filter[transaction_status][_eq]=Cancellation%20Requested` +
        `&filter[_and][0][_or][0][isPosted][_null]=true` +
        `&filter[_and][0][_or][1][isPosted][_eq]=false`;
    } else {
      // Active invoices: unposted, unpaid, and not cancelled or pending request
      filter =
        `filter[payment_status][_nin]=Paid,Fully Paid` +
        `&filter[_and][0][_or][0][isPosted][_null]=true` +
        `&filter[_and][0][_or][1][isPosted][_eq]=false` +
        `&filter[_and][1][_or][0][transaction_status][_nin]=Cancelled,CANCELLED,Cancellation%20Requested` +
        `&filter[_and][1][_or][1][transaction_status][_null]=true`;
    }

    if (searchTerm) {
      // Pre-fetch matching customers to search by customer name
      const matchingCust = await directusFetch<{ data: DirectusCustomer[] }>(
        `/items/customer?filter[customer_name][_contains]=${encodeURIComponent(searchTerm)}&fields=customer_code`
      ).catch(() => ({ data: [] }));
      const codes = matchingCust.data.map(c => c.customer_code).filter(Boolean);

      let searchOr = `&filter[_and][2][_or][0][invoice_no][_contains]=${encodeURIComponent(searchTerm)}`;
      searchOr += `&filter[_and][2][_or][1][customer_code][_contains]=${encodeURIComponent(searchTerm)}`;
      
      codes.forEach((code, idx) => {
        searchOr += `&filter[_and][2][_or][${idx + 2}][customer_code][_eq]=${encodeURIComponent(code)}`;
      });
      filter += searchOr;
    }

    const fields = [
      "invoice_id", "invoice_no", "customer_code", "invoice_date",
      "due_date", "gross_amount", "discount_amount", "payment_status",
      "transaction_status", "isPosted", "remarks"
    ].join(",");

    let pendingCount = 0;
    let res: DirectusListResponse<DirectusSalesInvoice>;

    if (statusTab === "pending" && !searchTerm) {
      res = await directusFetch<DirectusListResponse<DirectusSalesInvoice>>(
        `/items/sales_invoice?${filter}&fields=${fields}&limit=${limit}&page=${page}&meta=filter_count&sort=-invoice_id`
      );
      pendingCount = res.meta?.filter_count || 0;
    } else {
      const [mainRes, countRes] = await Promise.all([
        directusFetch<DirectusListResponse<DirectusSalesInvoice>>(
          `/items/sales_invoice?${filter}&fields=${fields}&limit=${limit}&page=${page}&meta=filter_count&sort=-invoice_id`
        ),
        directusFetch<DirectusListResponse<DirectusSalesInvoice>>(
          `/items/sales_invoice?filter[transaction_status][_eq]=Cancellation%20Requested&filter[_and][0][_or][0][isPosted][_null]=true&filter[_and][0][_or][1][isPosted][_eq]=false&limit=0&meta=filter_count`
        ).catch(() => ({ meta: { filter_count: 0 } }))
      ]);
      res = mainRes;
      pendingCount = countRes.meta?.filter_count || 0;
    }

    const invoices = res.data || [];
    const totalRows = res.meta?.filter_count || 0;
    const totalPages = Math.ceil(totalRows / limit);

    if (invoices.length === 0) {
      return NextResponse.json({
        role: userRole,
        username,
        rows: [],
        page,
        limit,
        totalRows: 0,
        totalPages: 0,
        pendingCount
      });
    }

    // Resolve Customer Names
    const customerCodes = Array.from(new Set(invoices.map(inv => inv.customer_code).filter((c): c is string => !!c)));
    let customersList: DirectusCustomer[] = [];
    if (customerCodes.length > 0) {
      const custRes = await directusFetch<{ data: DirectusCustomer[] }>(
        `/items/customer?filter[customer_code][_in]=${customerCodes.join(",")}&fields=customer_code,customer_name`
      ).catch(() => ({ data: [] }));
      customersList = custRes.data || [];
    }
    const customerMap = new Map<string, string>(customersList.map(c => [c.customer_code, c.customer_name]));

    const cancellationLookup = await getCancellationLookups(
      statusTab === "pending" ? invoices.map((invoice) => Number(invoice.invoice_id)) : []
    );

    const mappedRows = invoices.map(inv => {
      const match = inv.remarks?.match(/PrevStatus:\s*([A-Za-z0-9_]+)/);
      const previousStatus = match ? match[1] : "Onboarded";
      const cancellationRequest = cancellationLookup.get(Number(inv.invoice_id));
      return {
        invoiceId: inv.invoice_id,
        invoiceNo: inv.invoice_no,
        customerCode: inv.customer_code,
        customerName: customerMap.get(inv.customer_code || "") || inv.customer_code || "—",
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        netAmount: Number(inv.gross_amount || 0) - Number(inv.discount_amount || 0),
        paymentStatus: inv.payment_status || "Unpaid",
        transactionStatus: inv.transaction_status || "NULL",
        remarks: inv.remarks,
        previousStatus: cancellationRequest?.previousStatus || previousStatus,
        cancellationRequestId: cancellationRequest?.id ?? null,
        cancellationRequest: cancellationRequest
          ? {
              reason: cancellationRequest.reason,
              requester: cancellationRequest.requestedBy || "Unknown",
              requestedAt: cancellationRequest.requestedAt,
              status: cancellationRequest.status,
              attachments: cancellationRequest.attachments,
            }
          : null,
      };
    });

    return NextResponse.json({
      role: userRole,
      username,
      rows: mappedRows,
      page,
      limit,
      totalRows,
      totalPages,
      pendingCount
    });
  } catch (err: unknown) {
    console.error("[GET Transaction Cancellation Error]:", err);
    return NextResponse.json(
      { message: "Server error retrieving invoices", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ── POST: Request, approve, or reject cancellation ───────────────────────
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = decodeJwtPayload(token);
  const role = payload?.role || "USER";
  const username = [payload?.FirstName, payload?.LastName].filter(Boolean).join(" ") || payload?.email || "User";

  try {
    const contentType = request.headers.get("content-type") || "";
    let action = "";
    let invoiceId = 0;
    let reason = "";
    let rejectReason = "";
    let previousStatus = "";
    let requestId: string | null = null;
    let retrievalConfirmed = false;
    let attachmentFiles: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      action = String(formData.get("action") || "");
      invoiceId = Number(formData.get("invoiceId") || 0);
      reason = String(formData.get("reason") || "");
      rejectReason = String(formData.get("rejectReason") || "");
      previousStatus = String(formData.get("previousStatus") || "");
      requestId = formData.get("requestId") ? String(formData.get("requestId")) : null;
      retrievalConfirmed = String(formData.get("retrievalConfirmed") || "").toLowerCase() === "true";
      attachmentFiles = formData.getAll("attachments").filter(isFileEntry);
    } else {
      const body = await request.json() as {
        action?: string;
        invoiceId?: number | string;
        reason?: string;
        rejectReason?: string;
        previousStatus?: string;
        requestId?: string | number;
      };
      action = body.action || "";
      invoiceId = Number(body.invoiceId || 0);
      reason = body.reason || "";
      rejectReason = body.rejectReason || "";
      previousStatus = body.previousStatus || "";
      requestId = body.requestId !== undefined && body.requestId !== null ? String(body.requestId) : null;
    }

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ message: "invoiceId is required" }, { status: 400 });
    }

    // 1. Fetch current invoice details to verify status and grab current remarks
    const invoiceRes = await directusFetch<{ data: DirectusSalesInvoice }>(
      `/items/sales_invoice/${invoiceId}?fields=invoice_id,isPosted,transaction_status,remarks`
    );
    const invoice = invoiceRes.data;

    if (!invoice) {
      return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
    }

    if (parseBit(invoice.isPosted)) {
      return NextResponse.json({ message: "Cannot modify a posted invoice" }, { status: 400 });
    }

    const timeString = new Date().toLocaleString("en-PH");

    if (action === "request") {
      // ── REQUEST CANCELLATION ──
      if (invoice.transaction_status === "Cancellation Requested") {
        return NextResponse.json({ message: "Cancellation has already been requested for this invoice" }, { status: 400 });
      }
      if (invoice.transaction_status === "Cancelled" || invoice.transaction_status === "CANCELLED") {
        return NextResponse.json({ message: "Invoice is already cancelled" }, { status: 400 });
      }
      if (!reason || !reason.trim()) {
        return NextResponse.json({ message: "cancellation reason is required" }, { status: 400 });
      }
      if (attachmentFiles.length > 10) {
        return NextResponse.json({ message: "You can upload up to 10 attachments per cancellation request" }, { status: 400 });
      }
      for (const file of attachmentFiles) {
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        if (!isImage && !isPdf) {
          return NextResponse.json({ message: `Unsupported attachment type: ${file.name}. Upload an image or PDF.` }, { status: 400 });
        }
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json({ message: `${file.name} exceeds the 10 MB attachment limit` }, { status: 400 });
        }
      }

      const prevStatus = invoice.transaction_status || "NULL";
      const newRemarks = `${invoice.remarks ? invoice.remarks + "\n" : ""}[${timeString} CANCELLATION REQUESTED by ${username}] PrevStatus: ${prevStatus} | Reason: ${reason.trim()}`;
      let createdRequestId: string | number | null = null;
      const createdAttachmentIds: Array<string | number> = [];
      const uploadedFiles: UploadedDirectusFile[] = [];

      try {
        const requestResponse = await directusFetch<{ data?: DirectusCancellationRequest }>(
          `/items/${CANCELLATION_REQUESTS_COLLECTION}`,
          {
            method: "POST",
            body: JSON.stringify({
              invoice_id: invoiceId,
              reason: reason.trim(),
              previous_status: prevStatus,
              status: "PENDING",
              requested_by: username,
              requested_at: new Date().toISOString(),
              retrieval_confirmed: retrievalConfirmed,
            }),
          }
        );
        createdRequestId = requestResponse.data?.id ?? null;
        if (createdRequestId === null) throw new Error("Directus did not return a cancellation request ID");

        for (const file of attachmentFiles) {
          const uploadedFile = await uploadDirectusFile(file);
          uploadedFiles.push(uploadedFile);
          const attachmentResponse = await directusFetch<{ data?: DirectusCancellationAttachment }>(
            `/items/${CANCELLATION_ATTACHMENTS_COLLECTION}`,
            {
              method: "POST",
              body: JSON.stringify({
                cancellation_request_id: createdRequestId,
                file_id: uploadedFile.id,
                filename: uploadedFile.filename,
                mime_type: uploadedFile.mimeType || file.type,
                file_size: uploadedFile.size,
                uploaded_by: username,
                uploaded_at: new Date().toISOString(),
              }),
            }
          );
          const attachmentId = attachmentResponse.data?.id;
          if (attachmentId === undefined || attachmentId === null) {
            throw new Error("Directus did not return an attachment ID");
          }
          createdAttachmentIds.push(attachmentId);
        }

        await directusFetch<{ data: DirectusSalesInvoice }>(
          `/items/sales_invoice/${invoiceId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              transaction_status: "Cancellation Requested",
              remarks: newRemarks,
            }),
          }
        );
      } catch (error) {
        await cleanupCreatedCancellationData(createdRequestId, createdAttachmentIds, uploadedFiles);
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: "Cancellation request submitted.",
        requestId: createdRequestId,
        attachmentIds: createdAttachmentIds,
      });

    } else if (action === "approve") {
      // ── APPROVE CANCELLATION (Admin Only) ──
      if (role !== "ADMIN") {
        return NextResponse.json({ message: "Forbidden: Only Administrators can approve cancellations" }, { status: 403 });
      }

      const cancellationRequest = await getPendingCancellationRequest(invoiceId, requestId);
      if (requestId && !cancellationRequest) {
        return NextResponse.json({ message: "Pending cancellation request not found" }, { status: 404 });
      }

      const newRemarks = `${invoice.remarks ? invoice.remarks + "\n" : ""}[${timeString} CANCEL APPROVED by ${username}]`;

      await updateInvoiceAndRequest(
        invoiceId,
        { transaction_status: "CANCELLED", remarks: newRemarks },
        cancellationRequest,
        {
          status: "APPROVED",
          reviewed_by: username,
          reviewed_at: new Date().toISOString(),
          rejection_reason: null,
        },
        { transaction_status: "Cancellation Requested", remarks: invoice.remarks }
      );

      return NextResponse.json({ success: true, message: "Cancellation approved.", requestId: cancellationRequest?.id ?? null });

    } else if (action === "reject") {
      // ── REJECT CANCELLATION (Admin Only) ──
      if (role !== "ADMIN") {
        return NextResponse.json({ message: "Forbidden: Only Administrators can reject cancellation requests" }, { status: 403 });
      }
      if (!rejectReason || !rejectReason.trim()) {
        return NextResponse.json({ message: "Rejection reason is required" }, { status: 400 });
      }

      const cancellationRequest = await getPendingCancellationRequest(invoiceId, requestId);
      if (requestId && !cancellationRequest) {
        return NextResponse.json({ message: "Pending cancellation request not found" }, { status: 404 });
      }

      // Revert status to what it was before request (defaulting to "Onboarded")
      const requestPreviousStatus = cancellationRequest?.previous_status || previousStatus;
      const targetStatus = requestPreviousStatus && requestPreviousStatus !== "NULL" ? requestPreviousStatus : "Onboarded";
      const newRemarks = `${invoice.remarks ? invoice.remarks + "\n" : ""}[${timeString} CANCELLATION REJECTED by ${username}] Reason: ${rejectReason.trim()}`;

      await updateInvoiceAndRequest(
        invoiceId,
        { transaction_status: targetStatus, remarks: newRemarks },
        cancellationRequest,
        {
          status: "REJECTED",
          reviewed_by: username,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectReason.trim(),
        },
        { transaction_status: "Cancellation Requested", remarks: invoice.remarks }
      );

      return NextResponse.json({ success: true, message: "Cancellation request rejected.", requestId: cancellationRequest?.id ?? null });

    } else {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error("[POST Transaction Cancellation Error]:", err);
    return NextResponse.json(
      { message: "Failed to process cancellation request", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
