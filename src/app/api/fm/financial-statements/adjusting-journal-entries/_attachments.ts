import { NextResponse } from "next/server";
import { buildSpringItemPath, proxySpring, refreshedAccessToken } from "./_spring";

const MIME_BY_EXTENSION: Record<string,string> = {
  png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp", gif:"image/gif",
  bmp:"image/bmp", tif:"image/tiff", tiff:"image/tiff", pdf:"application/pdf", doc:"application/msword",
  docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls:"application/vnd.ms-excel",
  xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv:"text/csv", txt:"text/plain",
};
const INLINE_PREVIEW_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"]);
export type ReservedFile = { id: number; fileId: string; filename: string; mimeType: string; fileSize: number };

function directus() {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN;
  if (!base || !token) throw new Error("The supporting document service is not configured.");
  return { base, headers: { Authorization: `Bearer ${token}` } };
}
export function copySessionCookies(from: Response, to: NextResponse) {
  for (const cookie of from.headers.getSetCookie()) to.headers.append("Set-Cookie", cookie);
  return to;
}
export async function uploadSupportingFile(id: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType || file.size <= 0 || file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ message: "Choose an accepted image, PDF, Word, Excel, CSV, or text file up to 10 MB." }, { status: 400 });
  }
  const service = directus();
  const reservation = await proxySpring(buildSpringItemPath(id, "attachments"), {
    method: "POST", body: JSON.stringify({ filename: file.name, mimeType, fileSize: file.size }),
  });
  if (!reservation.ok) return reservation;
  const reserved = await reservation.json() as ReservedFile;
  let uploaded = false;
  try {
    const form = new FormData();
    form.append("id", reserved.fileId);
    form.append("file", new File([await file.arrayBuffer()], file.name, { type: mimeType }));
    const response = await fetch(`${service.base}/files`, { method: "POST", headers: service.headers, body: form, cache: "no-store" });
    if (!response.ok) throw new Error("The supporting document upload failed. Please retry.");
    uploaded = true;
    const payload = await response.json() as { data?: { id?: string } };
    if (payload.data?.id !== reserved.fileId) throw new Error("The document service returned an unexpected file ID.");
    const complete = await proxySpring(buildSpringItemPath(id, `attachments/${reserved.id}/complete`), { method: "POST" }, refreshedAccessToken(reservation));
    if (!complete.ok) throw new Error("The entry changed while uploading. Reload its supporting files before retrying.");
    return copySessionCookies(reservation, complete);
  } catch (error) {
    if (uploaded) await fetch(`${service.base}/files/${reserved.fileId}`, { method: "DELETE", headers: service.headers }).catch(() => undefined);
    await proxySpring(buildSpringItemPath(id, `attachments/${reserved.id}`), { method: "DELETE" }, refreshedAccessToken(reservation));
    return copySessionCookies(reservation, NextResponse.json(
      { message: error instanceof Error ? error.message : "Supporting document upload failed." }, { status: 502 }));
  }
}
export type SupportingFileView = "download" | "thumbnail" | "preview";

export async function downloadSupportingFile(id: string, attachmentId: string, view: SupportingFileView = "download") {
  const metadata = await proxySpring(buildSpringItemPath(id, `attachments/${encodeURIComponent(attachmentId)}`));
  if (!metadata.ok) return metadata;
  const file = await metadata.json() as ReservedFile;
  const normalizedMimeType = file.mimeType.trim().toLowerCase().split(";")[0];
  const canPreviewInline = INLINE_PREVIEW_MIME_TYPES.has(normalizedMimeType);
  if (view !== "download" && !canPreviewInline) {
    return copySessionCookies(metadata, NextResponse.json({ message: "Only supported image files can be previewed." }, { status: 415 }));
  }

  const service = directus();
  const assetUrl = new URL(`${service.base}/assets/${encodeURIComponent(file.fileId)}`);
  // Directus image transformations use Sharp, which does not support BMP input.
  const directusTransformSupported = normalizedMimeType !== "image/bmp";
  if (view === "thumbnail" && directusTransformSupported) assetUrl.searchParams.set("key", "system-small-cover");
  else if (view === "preview" && normalizedMimeType !== "image/gif" && directusTransformSupported) assetUrl.searchParams.set("key", "system-large-contain");
  const response = await fetch(assetUrl, { headers: service.headers, cache: "no-store" });
  if (!response.ok) return copySessionCookies(metadata, NextResponse.json({ message: "Supporting file is unavailable." }, { status: 502 }));
  const responseMimeType = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (view !== "download" && !responseMimeType?.startsWith("image/")) {
    return copySessionCookies(metadata, NextResponse.json({ message: "The image preview returned an unsupported format." }, { status: 502 }));
  }

  return copySessionCookies(metadata, new NextResponse(response.body, {
    headers: {
      "Content-Type": view === "download" ? file.mimeType : responseMimeType!,
      "Content-Disposition": `${view === "download" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox",
    },
  }));
}

