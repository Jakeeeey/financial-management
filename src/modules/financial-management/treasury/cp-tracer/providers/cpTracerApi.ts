import type {CPTracerResponse, CPTracerSearch} from "../types";

export async function searchCPTracer(
    search: CPTracerSearch,
    page: number,
    signal?: AbortSignal,
): Promise<CPTracerResponse> {
    const params = new URLSearchParams({
        cp: search.cp,
        invoice: search.invoice,
        memo: search.memo,
        sr: search.sr,
        page: String(page),
    });
    const response = await fetch(`/api/fm/treasury/cp-tracer?${params.toString()}`, {
        cache: "no-store",
        signal,
    });
    const payload = await response.json().catch(() => ({})) as {message?: string; error?: string} & Partial<CPTracerResponse>;
    if (!response.ok) {
        throw new Error(payload.message || payload.error || "CP Tracer search failed.");
    }
    return payload as CPTracerResponse;
}
