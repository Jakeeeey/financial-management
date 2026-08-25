"use client";

import React from "react";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieIcon, Award } from "lucide-react";
import {
    Card, CardHeader, CardTitle, CardContent, CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useCollectionOverview } from "../providers/CollectionOverviewProvider";
import { PaymentTypeData, SalesmanData } from "../types";
import { PaymentMethodDistribution } from "./PaymentMethodDistribution";

const CHART_COLORS = [
    "hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)", "hsl(47, 96%, 53%)",
    "hsl(0, 84%, 60%)", "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)",
    "hsl(24, 95%, 53%)", "hsl(330, 81%, 60%)", "hsl(168, 76%, 42%)", "hsl(280, 87%, 47%)",
];

export const OverviewCharts = () => {
    const { monthlyTrend, dailyTrend, paymentMethodData, salesmanData, formatCurrency } = useCollectionOverview();

    const trendData = monthlyTrend.length > 2 ? monthlyTrend : dailyTrend;
    const trendKey = monthlyTrend.length > 2 ? "month" : "date";

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
            {/* Row 1: Area trend + Pie */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Area trend */}
                <Card className="xl:col-span-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <CardTitle className="text-sm font-medium">Collection Trend</CardTitle>
                                <CardDescription className="text-xs">
                                    {monthlyTrend.length > 2 ? "Monthly" : "Daily"} collection amounts
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-4">
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                    <XAxis
                                        dataKey={trendKey}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                        dy={6}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                        tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                                        width={65}
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
                                        fill="url(#trendFill)"
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

            {/* Row 3: Bar + Rankings */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Horizontal Bar */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-muted-foreground" />
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
                                <BarChart data={salesmanData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
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
                                    <TableHead className="w-12 text-xs">Rank</TableHead>
                                    <TableHead className="text-xs">Salesman</TableHead>
                                    <TableHead className="text-xs text-right pr-6">Collections</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salesmanData.map((s: SalesmanData, i: number) => (
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
                                {salesmanData.length === 0 && (
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
