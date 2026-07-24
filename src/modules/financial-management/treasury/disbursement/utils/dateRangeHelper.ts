import {
    getManilaDateInput,
    getManilaDateOffsetInput,
    getManilaMonthEndInput,
    getManilaMonthStartInput,
    getManilaQuarterStartInput,
    getManilaYearEndInput,
    getManilaYearStartInput,
} from "./disbursement-utils";

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
            const s = getManilaDateInput();
            return { start: s, end: s };
        }
    },
    {
        value: "yesterday",
        label: "Yesterday",
        getRange: () => {
            const s = getManilaDateOffsetInput(-1);
            return { start: s, end: s };
        }
    },
    {
        value: "last_7_days",
        label: "Last 7 Days",
        getRange: () => {
            const end = getManilaDateInput();
            const start = getManilaDateOffsetInput(-6);
            return { start, end };
        }
    },
    {
        value: "last_30_days",
        label: "Last 30 Days",
        getRange: () => {
            const end = getManilaDateInput();
            const start = getManilaDateOffsetInput(-29);
            return { start, end };
        }
    },
    {
        value: "this_month",
        label: "This Month",
        getRange: () => {
            const start = getManilaMonthStartInput();
            const end = getManilaDateInput();
            return { start, end };
        }
    },
    {
        value: "last_month",
        label: "Last Month",
        getRange: () => {
            const start = getManilaMonthStartInput(-1);
            const end = getManilaMonthEndInput(-1);
            return { start, end };
        }
    },
    {
        value: "this_quarter",
        label: "This Quarter",
        getRange: () => {
            const start = getManilaQuarterStartInput();
            const end = getManilaDateInput();
            return { start, end };
        }
    },
    {
        value: "ytd",
        label: "Year to Date (YTD)",
        getRange: () => {
            const start = getManilaYearStartInput();
            const end = getManilaDateInput();
            return { start, end };
        }
    },
    {
        value: "all_time",
        label: "All Time",
        getRange: () => {
            const start = "2020-01-01";
            const end = getManilaYearEndInput(1);
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
