export interface QuickRangeOption {
    value: string;
    label: string;
    getRange: () => { start: string; end: string };
}

export const QUICK_RANGES: QuickRangeOption[] = [
    {
        value: "today",
        label: "Today",
        getRange: () => {
            const d = new Date();
            const s = d.toISOString().split("T")[0];
            return { start: s, end: s };
        }
    },
    {
        value: "yesterday",
        label: "Yesterday",
        getRange: () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const s = d.toISOString().split("T")[0];
            return { start: s, end: s };
        }
    },
    {
        value: "last_7_days",
        label: "Last 7 Days",
        getRange: () => {
            const d = new Date();
            const end = d.toISOString().split("T")[0];
            d.setDate(d.getDate() - 6);
            const start = d.toISOString().split("T")[0];
            return { start, end };
        }
    },
    {
        value: "last_30_days",
        label: "Last 30 Days",
        getRange: () => {
            const d = new Date();
            const end = d.toISOString().split("T")[0];
            d.setDate(d.getDate() - 29);
            const start = d.toISOString().split("T")[0];
            return { start, end };
        }
    },
    {
        value: "this_month",
        label: "This Month",
        getRange: () => {
            const d = new Date();
            const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
            const end = d.toISOString().split("T")[0];
            return { start, end };
        }
    },
    {
        value: "last_month",
        label: "Last Month",
        getRange: () => {
            const d = new Date();
            const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split("T")[0];
            const end = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split("T")[0];
            return { start, end };
        }
    },
    {
        value: "this_quarter",
        label: "This Quarter",
        getRange: () => {
            const d = new Date();
            const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
            const start = new Date(d.getFullYear(), quarterStartMonth, 1).toISOString().split("T")[0];
            const end = d.toISOString().split("T")[0];
            return { start, end };
        }
    },
    {
        value: "ytd",
        label: "Year to Date (YTD)",
        getRange: () => {
            const d = new Date();
            const start = new Date(d.getFullYear(), 0, 1).toISOString().split("T")[0];
            const end = d.toISOString().split("T")[0];
            return { start, end };
        }
    },
    {
        value: "all_time",
        label: "All Time",
        getRange: () => {
            const d = new Date();
            const start = "2020-01-01";
            const end = new Date(d.getFullYear() + 1, 11, 31).toISOString().split("T")[0];
            return { start, end };
        }
    }
];

export const detectQuickRange = (start?: string, end?: string): string => {
    if (!start || !end) return "custom";
    for (const r of QUICK_RANGES) {
        const range = r.getRange();
        if (range.start === start && range.end === end) {
            return r.value;
        }
    }
    return "custom";
};
