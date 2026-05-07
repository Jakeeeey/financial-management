"use client";

import React, { useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, Activity, PieChart as PieIcon, Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useDailyCollectionReport } from "../hooks/useDailyCollectionReport";
import { PaymentTypeData } from "../types";
import { PaymentMethodDistribution } from "./PaymentMethodDistribution";

const CHART_COLORS = [
    "hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)", "hsl(47, 96%, 53%)",
    "hsl(0, 84%, 60%)", "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)",
    "hsl(24, 95%, 53%)", "hsl(330, 81%, 60%)", "hsl(168, 76%, 42%)", "hsl(280, 87%, 47%)",
];

export const CollectionCharts = () => {
    const {
        hourlyChartData,
        reportData,
        paymentMethodData,
        formatCurrency,
    } = useDailyCollectionReport();

    const salesmanPerformance = useMemo(() => {
        const collections: Record<string, number> = {};
        reportData.forEach((item) => {
            if (!item.salesman) return;
            collections[item.salesman] = (collections[item.salesman] || 0) + Math.abs(item.totalAmount || 0);
        });
        return Object.entries(collections)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);
    }, [reportData]);

    const topSalesmen = useMemo(() => salesmanPerformance.slice(0, 10), [salesmanPerformance]);

    const coloredPayment = paymentMethodData.map((d, i) => ({
        ...d,
        color: d.color || CHART_COLORS[i % CHART_COLORS.length],
    }));

    const tooltipStyle: React.CSSProperties = {
        borderRadius: "var(--radius)",
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
        fontSize: 12,
        color: "hsl(var(--foreground))",
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Row 1: Hourly Trend + Pie */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Hourly trend area chart */}
                <Card className="xl:col-span-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <CardTitle className="text-sm font-medium">Collection Trend</CardTitle>
                                <CardDescription className="text-xs">Hourly distribution for selected date</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-4">
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={hourlyChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="dailyTrendFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="time"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                        dy={6}
                                        interval={2}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                        tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                                        width={52}
                                    />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        itemStyle={{ color: "hsl(var(--foreground))" }}
                                        labelStyle={{ color: "hsl(var(--foreground))" }}
                                        formatter={(val: number) => [formatCurrency(val), "Amount"]}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="amount"
                                        stroke="hsl(221, 83%, 53%)"
                                        strokeWidth={2}
                                        fill="url(#dailyTrendFill)"
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Pie chart */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <PieIcon className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <CardTitle className="text-sm font-medium">By Payment Type</CardTitle>
                                <CardDescription className="text-xs">Distribution of collection methods</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-4 flex flex-col items-center gap-4">
                        <div className="h-[160px] w-full max-w-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={coloredPayment}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={75}
                                        dataKey="value"
                                        nameKey="name"
                                        stroke="none"
                                    >
                                        {coloredPayment.map((entry: PaymentTypeData, i: number) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        itemStyle={{ color: "hsl(var(--foreground))" }}
                                        labelStyle={{ color: "hsl(var(--foreground))" }}
                                        formatter={(v: number, name: string) => [formatCurrency(v), name]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <Separator />
                        <ScrollArea className="w-full max-h-[140px]">
                            <div className="flex flex-col gap-2 pr-4">
                                {coloredPayment.map((m: PaymentTypeData, i: number) => (
                                    <div key={i} className="flex items-start gap-2 w-full">
                                        <div className="w-2 h-2 rounded-sm flex-shrink-0 mt-1" style={{ backgroundColor: m.color }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-muted-foreground leading-relaxed break-words" title={m.name}>
                                                {m.name}
                                            </p>
                                        </div>
                                        <span className="text-xs font-medium tabular-nums ml-auto whitespace-nowrap pl-2">
                                            {formatCurrency(m.value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Row 2: Detailed Payment Method Distribution */}
            <PaymentMethodDistribution />

            {/* Row 3: Salesman Bar + Salesman Rankings */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Horizontal Bar */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <CardTitle className="text-sm font-medium">Top Salesmen</CardTitle>
                                <CardDescription className="text-xs">Collections by salesman (top 10)</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-4">
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topSalesmen} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        type="number"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                        tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                                    />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                        width={90}
                                    />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        itemStyle={{ color: "hsl(var(--foreground))" }}
                                        labelStyle={{ color: "hsl(var(--foreground))" }}
                                        formatter={(v: number) => [formatCurrency(v), "Total"]}
                                    />
                                    <Bar
                                        dataKey="amount"
                                        fill="hsl(221, 83%, 53%)"
                                        radius={[0, 4, 4, 0]}
                                        barSize={16}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Rankings Table */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <CardTitle className="text-sm font-medium">Salesman Rankings</CardTitle>
                                <CardDescription className="text-xs">Sorted by total collections</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <ScrollArea className="h-[320px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs w-12">Rank</TableHead>
                                    <TableHead className="text-xs">Salesman</TableHead>
                                    <TableHead className="text-xs text-right pr-6">Collections</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salesmanPerformance.map((s, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-xs text-muted-foreground font-medium">
                                            {i + 1}
                                        </TableCell>
                                        <TableCell className="text-xs font-medium">{s.name}</TableCell>
                                        <TableCell className="text-xs font-semibold text-right tabular-nums pr-6">
                                            {formatCurrency(s.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {salesmanPerformance.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-20 text-center text-xs text-muted-foreground">
                                            No data available
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </Card>
            </div>
        </div>
    );
};
