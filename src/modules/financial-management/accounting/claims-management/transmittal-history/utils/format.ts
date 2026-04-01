export function formatMoneyPHP(v: number) {
    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 2,
        }).format(v);
    } catch {
        return `₱${Number(v || 0).toFixed(2)}`;
    }
}

export function formatDateMDY(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
    }).format(d);
}

export function debounceMs<T>(value: T, delay = 250) {
    // helper for hooks, avoids duplicating logic
    return { value, delay };
}
