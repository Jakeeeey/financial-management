import type { BufferLike } from "./types";

export function toNumberSafe(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

export function toBoolLike(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";

    // handle Buffer-like: { type: "Buffer", data: [1] }
    const obj = v as Partial<BufferLike>;
    if (obj && Array.isArray(obj.data) && obj.data.length > 0) {
        return obj.data[0] === 1;
    }

    return false;
}
