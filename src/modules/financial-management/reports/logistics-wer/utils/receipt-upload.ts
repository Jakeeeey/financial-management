export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const RECEIPT_UPLOAD_TIMEOUT_MS = 60_000;
export const RECEIPT_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
export const RECEIPT_GUIDANCE = "Supported formats: JPG, PNG, PDF. Max file size: 5 MB per file.";
export const RECEIPT_SIZE_ERROR = "File size exceeds the 5 MB limit. Please select a smaller file or compress your attachment.";

export function validateReceiptFile(file: { name: string; size: number; type: string }): { message: string; status: number } | null {
  if (file.size === 0) return { message: "Please select a non-empty file.", status: 400 };
  if (file.size > MAX_RECEIPT_BYTES) return { message: RECEIPT_SIZE_ERROR, status: 413 };
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expected = extension === "jpg" || extension === "jpeg" ? "image/jpeg"
    : extension === "png" ? "image/png" : extension === "pdf" ? "application/pdf" : null;
  if (!expected || (file.type && file.type.toLowerCase() !== expected)) {
    return { message: "Unsupported file format. Please select a JPG, PNG, or PDF file.", status: 415 };
  }
  return null;
}
