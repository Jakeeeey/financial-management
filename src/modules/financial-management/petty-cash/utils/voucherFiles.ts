export const VOUCHER_FILE_LIMIT = 5 * 1024 * 1024;
export const VOUCHER_FILE_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
export const VOUCHER_FILE_GUIDANCE = "Supported formats: JPG, PNG, PDF. Maximum 5 MB per file.";
export function voucherFileError(file: { name: string; size: number; type: string }): { status: number; message: string } | null {
  if (!file.size) return { status: 400, message: "Choose a non-empty supporting file." };
  if (file.size > VOUCHER_FILE_LIMIT) return { status: 413, message: "File size exceeds the 5 MB limit. Select a smaller file." };
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expected = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "png" ? "image/png" : extension === "pdf" ? "application/pdf" : "";
  if (!expected || file.type && file.type.toLowerCase() !== expected) return { status: 415, message: "Unsupported format. Choose a JPG, PNG, or PDF file." };
  if (file.name.length > 255 || /[\\/\r\n]/.test(file.name)) return { status: 400, message: "Use a filename of up to 255 characters without path separators." };
  return null;
}
