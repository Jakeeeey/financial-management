"use client";

import React from "react";
import { DollarSign, Activity, Users, TrendingUp, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCollectionOverview } from "../providers/CollectionOverviewProvider";

export const OverviewKPIs = () => {
    const { stats, formatCurrency } = useCollectionOverview();

    const kpis = [
        {
            title: "Total Amount",
            value: formatCurrency(stats.totalCollections),
            icon: DollarSign,
            sub: `${stats.totalTransactions} transactions`,
        },
        {
            title: "Unique Salesmen",
            value: stats.uniqueSalesmen,
            icon: Users,
            sub: "active collectors",
        },
        {
            title: "Avg. Per Transaction",
            value: formatCurrency(stats.avgCollection),
            icon: Activity,
            sub: "average collection",
        },
        {
            title: "Posted",
            value: stats.totalPosted,
            icon: CheckCircle,
            sub: "collection entries",
        },
        {
            title: "Pending",
            value: stats.totalPending,
            icon: Clock,
            sub: "awaiting posting",
        },
        {
            title: "Total Transactions",
            value: stats.totalTransactions,
            icon: TrendingUp,
            sub: "collection entries",
        },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {kpis.map((kpi, i) => (
                <Card key={i}>
                    <CardContent className="pt-5 pb-4 px-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-muted-foreground font-medium truncate">{kpi.title}</p>
                            <kpi.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                        <Separator className="mb-3" />
                        <p 
                            className="text-2xl font-bold tracking-tight truncate px-1" 
                            title={String(kpi.value)}
                        >
                            {kpi.value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate px-1">{kpi.sub}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
