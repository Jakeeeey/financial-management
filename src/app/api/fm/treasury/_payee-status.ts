export function isEffectivelyActivePayee(value: unknown): boolean {
    return value == null || value === true || value === 1 || value === "1";
}
