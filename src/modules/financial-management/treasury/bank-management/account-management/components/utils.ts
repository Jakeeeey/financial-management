export function sanitizeAccountNumber(value: string) {
  return value.replace(/[^A-Za-z0-9-]/g, "").replace(/-+/g, "-");
}

export function sanitizeMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 20);
}

export function normalizeOptionInput(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeOptionKey(value: string) {
  return normalizeOptionInput(value).toLowerCase();
}

export function compactOptionKey(value: string) {
  return normalizeOptionKey(value).replace(/[^a-z0-9]/g, "");
}
