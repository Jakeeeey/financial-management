export const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");
export const DIRECTUS_STATIC_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "").trim();

export const CANCELLATION_REQUESTS_COLLECTION = "sales_invoice_cancellation_requests";
export const CANCELLATION_ATTACHMENTS_COLLECTION = "sales_invoice_cancellation_attachments";

export interface DirectusCancellationRequest {
  id: string | number;
  invoice_id: number;
  reason: string;
  previous_status: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  requested_by: string | null;
  requested_at: string | null;
  retrieval_confirmed: unknown;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface DirectusCancellationAttachment {
  id: string | number;
  cancellation_request_id: string | number;
  file_id: string;
  filename: string;
  mime_type: string;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
}

export interface UploadedDirectusFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export async function directusFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_STATIC_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

  const res = await fetch(`${DIRECTUS_URL}${path.startsWith("/") ? "" : "/"}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus error ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function uploadDirectusFile(file: File): Promise<UploadedDirectusFile> {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_STATIC_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

  const formData = new FormData();
  formData.append("file", file, file.name);
  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` },
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus file upload failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    data?: {
      id?: string;
      filename_download?: string;
      type?: string;
      filesize?: number;
    };
  };
  if (!payload.data?.id) throw new Error("Directus file upload returned no file ID");

  return {
    id: payload.data.id,
    filename: payload.data.filename_download || file.name,
    mimeType: payload.data.type || file.type,
    size: Number(payload.data.filesize ?? file.size),
  };
}

export async function deleteDirectusRecord(collection: string, id: string | number): Promise<void> {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_STATIC_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

  const res = await fetch(`${DIRECTUS_URL}/items/${collection}/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Directus record deletion failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function deleteDirectusFile(id: string): Promise<void> {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_STATIC_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

  const res = await fetch(`${DIRECTUS_URL}/files/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Directus file deletion failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
