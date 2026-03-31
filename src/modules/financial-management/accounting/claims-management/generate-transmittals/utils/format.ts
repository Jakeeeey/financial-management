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
