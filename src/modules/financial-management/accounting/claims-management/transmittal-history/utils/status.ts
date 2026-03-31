// src/modules/claims-management/transmittal-history/utils/status.ts

export function normalizeStatusKey(status: string) {
    return String(status ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " "); // normalize multiple spaces
}

export function prettyStatus(status: string) {
    const s = String(status ?? "").trim();
    if (!s) return "—";

    return s
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function statusTone(status: string) {
    const key = String(status ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

    if (key === "FOR RECEIVING") return "forReceiving";
    if (key === "FOR PAYMENT") return "forPayment";
    if (key === "POSTED") return "posted";
    if (key === "RECEIVED") return "received";

    return "default";
}


