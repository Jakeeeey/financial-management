"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ApprovalTypeFilter } from "../types";

const TYPE_TABS: Array<{ value: ApprovalTypeFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "price", label: "Price Type" },
    { value: "cost", label: "List Price" },
];

export function PcrTypeTabList() {
    return (
        <TabsList className="mb-2">
            {TYPE_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                </TabsTrigger>
            ))}
        </TabsList>
    );
}
