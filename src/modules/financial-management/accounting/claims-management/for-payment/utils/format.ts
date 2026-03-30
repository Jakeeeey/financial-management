export function toNumberSafe(v: unknown): number {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;

    if (typeof v === "string") {
        const s = v.trim();
        if (!s) return 0;

        // allow commas like "1,234.56"
        const cleaned = s.replace(/,/g, "");
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : 0;
    }

    if (typeof v === "boolean") return v ? 1 : 0;

    // optional: handle numeric objects (rare)
    if (typeof v === "bigint") {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    return 0;
}

export function formatPHP(n: number): string {
    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 2,
        }).format(n);
    } catch {
        return `₱${n.toFixed(2)}`;
    }
}

export function formatDateTime(iso?: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}