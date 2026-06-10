import { cn } from "@/lib/utils";

import type { PCRStatus } from "../types";

const STATUS_VALUES: PCRStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

export const pcrApproveButtonClass =
    "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/20 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus-visible:ring-emerald-500/40";

export const pcrRejectButtonClass =
    "border-red-600 text-red-600 hover:border-red-600 hover:bg-red-600 hover:text-white focus-visible:ring-red-500/20 dark:border-red-500 dark:text-red-500 dark:hover:border-red-500 dark:hover:bg-red-600 dark:hover:text-white dark:focus-visible:ring-red-500/40";

export function normalizePcrStatus(status: string): PCRStatus | null {
    const normalized = status.trim().toUpperCase();
    return STATUS_VALUES.includes(normalized as PCRStatus) ? (normalized as PCRStatus) : null;
}

export function pcrStatusBadgeClass(status: string): string {
    const normalized = normalizePcrStatus(status);

    switch (normalized) {
        case "PENDING":
            return "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";
        case "APPROVED":
            return "border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
        case "REJECTED":
            return "border-red-200 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200";
        case "CANCELLED":
            return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
        default:
            return "";
    }
}

export function pcrStatusTabTriggerClass(status: "PENDING" | "APPROVED" | "REJECTED"): string {
    switch (status) {
        case "PENDING":
            return cn(
                "text-amber-800 dark:text-amber-300",
                "data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-sm",
            );
        case "APPROVED":
            return cn(
                "text-emerald-800 dark:text-emerald-300",
                "data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
            );
        case "REJECTED":
            return cn(
                "text-red-800 dark:text-red-300",
                "data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
            );
    }
}
