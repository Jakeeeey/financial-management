const LOGIN_PATH = "/login";
const DEFAULT_RETURN_PATH = "/main-dashboard";

export function safeReturnPath(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : DEFAULT_RETURN_PATH;
}

export function currentReturnPath(): string {
  if (typeof window === "undefined") return DEFAULT_RETURN_PATH;
  return safeReturnPath(`${window.location.pathname}${window.location.search}`);
}

export function loginUrl(returnPath: string = currentReturnPath()): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(safeReturnPath(returnPath))}`;
}

let redirecting = false;

export function redirectToLogin(returnPath?: string): boolean {
  if (typeof window === "undefined" || redirecting) return false;
  redirecting = true;
  window.location.assign(loginUrl(returnPath));
  return true;
}

export function isUnauthorized(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "status" in error && (error as { status?: unknown }).status === 401);
}
