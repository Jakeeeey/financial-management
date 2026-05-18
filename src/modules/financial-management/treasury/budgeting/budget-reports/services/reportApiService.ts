/**
 * Dedicated API Proxy utility for Budget Reports module.
 * This ensures the module is self-contained and does not rely on services from other modules.
 */

export async function fetchProxy<T = unknown>(url: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err?.message || (err?.errors && err.errors[0] ? err.errors[0].message : null) || `Report Proxy Error: ${res.statusText}`;
      throw new Error(message);
    }

    if (res.status === 204) return null;
    
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return await res.json() as T;
    }
    
    return null;
  } catch (error: unknown) {
    console.error("Budget Report Proxy Error:", error);
    throw error;
  }
}
