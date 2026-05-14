"use client";

import React from "react";
import { CollectionOverviewProvider, useCollectionOverview } from "./providers/CollectionOverviewProvider";
import { OverviewHeader } from "./components/OverviewHeader";
import { OverviewKPIs } from "./components/OverviewKPIs";
import { OverviewCharts } from "./components/OverviewCharts";
import { OverviewTable } from "./components/OverviewTable";
import { OverviewLoading } from "./components/OverviewLoading";
import { Separator } from "@/components/ui/separator";

function CollectionOverviewDashboard() {
    const { isLoading } = useCollectionOverview();

    if (isLoading) return <OverviewLoading />;

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1600px] mx-auto">
            <OverviewHeader />
            <Separator />
            <OverviewKPIs />
            <OverviewCharts />
            <OverviewTable />
        </div>
    );
}

export default function CollectionOverviewReportModule() {
    return (
        <CollectionOverviewProvider>
            <CollectionOverviewDashboard />
        </CollectionOverviewProvider>
    );
}
