"use client";

import React from "react";
import { DailyCollectionReportProvider } from "./providers/DailyCollectionReportProvider";
import { useDailyCollectionReport } from "./hooks/useDailyCollectionReport";
import { CollectionHeader } from "./components/CollectionHeader";
import { CollectionKPIs } from "./components/CollectionKPIs";
import { CollectionCharts } from "./components/CollectionCharts";
import { CollectionTable } from "./components/CollectionTable";
import { CollectionLoading } from "./components/CollectionLoading";
import { Separator } from "@/components/ui/separator";

function DailyCollectionDashboard() {
    const { isLoading } = useDailyCollectionReport();
    if (isLoading) {
        return <CollectionLoading />;
    }
    return (
        <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1600px] mx-auto">
            <CollectionHeader />
            <Separator />
            <CollectionKPIs />
            <CollectionCharts />
            <CollectionTable />
        </div>
    );
}

export default function DailyCollectionReportModule() {
    return (
        <DailyCollectionReportProvider>
            <DailyCollectionDashboard />
        </DailyCollectionReportProvider>
    );
}
