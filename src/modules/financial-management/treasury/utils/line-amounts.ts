export function sumLineAmounts(lines: Array<{ amount: number }>): number {
    return lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}
