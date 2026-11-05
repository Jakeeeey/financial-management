import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { readPettyCash } from "../_spring";
import { refreshedAccessToken } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { voucherFileError, VOUCHER_FILE_LIMIT } from "@/modules/financial-management/petty-cash/utils/voucherFiles";
import type { VoucherAttachment } from "@/modules/financial-management/petty-cash/voucher-types";

export function fileError(message: string, status: number) { return NextResponse.json({ code: "INVALID_REQUEST", message, requestId: crypto.randomUUID() }, { status, headers: { "Cache-Control": "no-store" } }); }
function directus() {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN;
  if (!base || !token) throw new Error("Supporting file storage is not configured.");
  return { base, headers: { Authorization: `Bearer ${token}` } };
}
export function signature(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value)) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}
const checksum = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const commandKey = (requestId: string) => { const value = createHash("sha256").update(`PCV_COMPLETE:${requestId}`).digest("hex"); return `${value.slice(0,8)}-${value.slice(8,12)}-4${value.slice(13,16)}-8${value.slice(17,20)}-${value.slice(20,32)}`; };
function cookiesFrom(from: Response, to: Response) { for (const cookie of from.headers.getSetCookie()) to.headers.append("Set-Cookie", cookie); return to; }
async function storedBytes(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader(); if (!reader) throw new Error("File data is unavailable.");
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > VOUCHER_FILE_LIMIT) throw new Error("Stored file exceeds the 5 MB limit."); chunks.push(value); } }
  finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks, size);
}
type FileOwner = "disbursement/vouchers" | "replenishment/requests";
export async function uploadVoucherFile(voucherId: string, form: FormData, owner: FileOwner = "disbursement/vouchers") {
  const file = form.get("file"), requestId = String(form.get("requestId") || ""), version = Number(form.get("version")), lineId = Number(form.get("lineId"));
  if (!(file instanceof File)) return fileError("Choose a supporting file.", 400);
  const invalid = voucherFileError(file); if (invalid) return fileError(invalid.message, invalid.status);
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId) || !Number.isSafeInteger(version) || version < 0 || owner === "disbursement/vouchers" && (!Number.isSafeInteger(lineId) || lineId <= 0)) return fileError("Send the document version, receipt line when applicable, and a stable request UUID.", 400);
  const bytes = new Uint8Array(await file.arrayBuffer()), mimeType = signature(bytes);
  const extensionMime = /\.png$/i.test(file.name) ? "image/png" : /\.pdf$/i.test(file.name) ? "application/pdf" : "image/jpeg";
  if (!mimeType || mimeType !== extensionMime || file.type && file.type !== mimeType) return fileError("The file contents do not match a supported JPG, PNG, or PDF format.", 415);
  const path = `${owner}/${voucherId}/attachments`;
  const reserve = await readPettyCash(`${path}/reserve`, { method: "POST", body: JSON.stringify({ requestId, version, ...(owner === "disbursement/vouchers" ? { lineId } : {}), filename: file.name, mimeType, fileSize: bytes.length, sha256: checksum(bytes) }) });
  if (!reserve.ok) return reserve;
  const reserved = await reserve.json() as VoucherAttachment, token = refreshedAccessToken(reserve);
  try {
    // Resolve retries against server metadata before uploading or completing again.
    const current = await readPettyCash(`${path}/${reserved.id}`, undefined, token);
    if (!current.ok) return cookiesFrom(reserve, current);
    const metadata = await current.json() as VoucherAttachment;
    if (metadata.state === "READY") return cookiesFrom(reserve, NextResponse.json(metadata, { headers: { "Cache-Control": "no-store" } }));
    const service = directus(); const asset = `${service.base}/assets/${encodeURIComponent(metadata.fileId)}`;
    if (!metadata.stored) {
      const data = new FormData(); data.append("id", metadata.fileId); data.append("file", new File([bytes], file.name, { type: mimeType }));
      const uploaded = await fetch(`${service.base}/files`, { method: "POST", headers: service.headers, body: data, cache: "no-store", signal: AbortSignal.timeout(60_000) });
      if (!uploaded.ok || (await uploaded.json())?.data?.id !== metadata.fileId) throw new Error("The supporting file could not be uploaded. Retry this file.");
    }
    const stored = await fetch(asset, { headers: service.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!stored.ok) throw new Error("The supporting file could not be verified. Retry this file.");
    const actual = await storedBytes(stored);
    if (actual.length !== metadata.fileSize || signature(actual) !== metadata.mimeType || checksum(actual) !== metadata.sha256) throw new Error("Stored file validation failed. Remove this upload and attach the original file again.");
    const completed = await readPettyCash(`${path}/${metadata.id}/complete`, { method: "POST", body: JSON.stringify({ requestId: commandKey(requestId), version: metadata.voucherVersion }) }, token);
    return cookiesFrom(reserve, completed);
  } catch {
    // Keep the reservation for an explicit retry; an uncertain completion must never delete a READY file.
    return cookiesFrom(reserve, fileError("The draft is saved, but this file has not finished uploading. Retry it or remove the pending upload after reopening the draft.", 503));
  }
}
export async function readVoucherFile(voucherId: string, fileId: string, preview: boolean, owner: FileOwner | "replenishment-approval/requests" = "disbursement/vouchers") {
  const metadataResponse = await readPettyCash(`${owner}/${voucherId}/attachments/${fileId}`);
  if (!metadataResponse.ok) return metadataResponse;
  const file = await metadataResponse.json() as VoucherAttachment;
  if (file.state !== "READY") return cookiesFrom(metadataResponse, fileError("This upload is not yet available as supporting evidence.", 404));
  try {
    const service = directus(); const response = await fetch(`${service.base}/assets/${encodeURIComponent(file.fileId)}`, { headers: service.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("Unavailable");
    const bytes = await storedBytes(response);
    if (signature(bytes) !== file.mimeType || bytes.length !== file.fileSize || checksum(bytes) !== file.sha256) throw new Error("Invalid stored content");
    return cookiesFrom(metadataResponse, new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": file.mimeType, "Content-Disposition": `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" } }));
  } catch { return cookiesFrom(metadataResponse, fileError("The supporting file is unavailable or failed content validation. Retry the download.", 503)); }
}
export async function removeVoucherFile(voucherId: string, fileId: string, body: object, owner: FileOwner = "disbursement/vouchers") {
  const result = await readPettyCash(`${owner}/${voucherId}/attachments/${fileId}/remove`, { method: "POST", body: JSON.stringify(body) });
  if (!result.ok) return result;
  const metadata = await result.clone().json() as VoucherAttachment;
  if (metadata.state === "REMOVED") try { const service = directus(); await fetch(`${service.base}/files/${encodeURIComponent(metadata.fileId)}`, { method: "DELETE", headers: service.headers, signal: AbortSignal.timeout(15_000) }); } catch { /* Ownership metadata remains removed; retryable cleanup never restores access. */ }
  return result;
}
