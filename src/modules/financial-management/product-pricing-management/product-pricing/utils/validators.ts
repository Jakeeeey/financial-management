export function validatePrice(v: number | null): string | null {
    if (v === null) return null; // allowed
    if (!Number.isFinite(v)) return "Invalid number";
    if (v < 0) return "Price cannot be negative";
    if (v > 99999999.99) return "Price too large";
    return null;
}
