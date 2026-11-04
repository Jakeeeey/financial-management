import { parsePettyCashContext } from "../types";

export class PettyCashApiError extends Error {
  constructor(message: string, readonly status: number, readonly requestId?: string) { super(message); }
}
export async function loadPettyCashContext(signal: AbortSignal) {
  const response = await fetch("/api/fm/petty-cash/context", { cache: "no-store", signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new PettyCashApiError(data?.message || "Unable to load Petty Cash.", response.status, data?.requestId);
  try { return parsePettyCashContext(data); }
  catch { throw new PettyCashApiError("Petty Cash returned incomplete workspace information. Please retry.", 503); }
}
