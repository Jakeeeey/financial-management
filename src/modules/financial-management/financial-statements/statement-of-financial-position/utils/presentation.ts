import { KeyRatios } from "../types";

export const balanceSheetRatioDefinitions = [
    { key: "currentRatio", label: "Current ratio", formula: "Current assets / Current liabilities" },
    { key: "quickRatio", label: "Quick ratio", formula: "(Current assets less inventory) / Current liabilities" },
    { key: "debtToEquity", label: "Debt-to-equity ratio", formula: "Total liabilities / Total equity" },
    { key: "debtRatio", label: "Debt ratio", formula: "Total liabilities / Total assets" },
] as const satisfies readonly { key: keyof KeyRatios; label: string; formula: string }[];

export function formatPesoAmount(value: number) {
    const magnitude = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value < 0 ? `-\u20B1${magnitude}` : `\u20B1${magnitude}`;
}

export function describePesoChange(change: number) {
    if (change > 0) return `Increased by ${formatPesoAmount(change)}`;
    if (change < 0) return `Decreased by ${formatPesoAmount(Math.abs(change))}`;
    return "No change";
}

export function formatRatio(value: number | null) {
    return value === null ? "Not applicable" : `${value.toFixed(2)}\u00D7`;
}

export function describeRatioChange(change: number) {
    if (change > 0) return `Increased by ${change.toFixed(2)}\u00D7`;
    if (change < 0) return `Decreased by ${Math.abs(change).toFixed(2)}\u00D7`;
    return "No change";
}
