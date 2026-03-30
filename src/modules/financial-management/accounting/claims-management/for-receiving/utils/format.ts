//src/modules/financial-management/claims-management/for-receiving/utils/format.ts
export function toNumberSafe(v: unknown): number {
    const n =
        typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
    return Number.isFinite(n) ? n : 0;
}

export function formatPHP(v: number) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
    }).format(v);
}

export function formatDateTime(v?: string | null) {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}
