export function toNumberOrNull(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export function formatPHP(amount: number | null): string {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(amount);
}

export function clampMoney(v: number | null): number | null {
    if (v === null) return null;
    const rounded = Math.round(v * 10000) / 10000;
    return rounded;
}