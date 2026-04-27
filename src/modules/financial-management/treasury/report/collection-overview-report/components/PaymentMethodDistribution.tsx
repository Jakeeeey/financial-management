"use client";

import React from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from "recharts";
import { CreditCard } from "lucide-react";
import {
    Card, CardHeader, CardTitle, CardContent, CardDescription,
} from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useCollectionOverview } from "../providers/CollectionOverviewProvider";

export const PaymentMethodDistribution = () => {
    const { detailedPaymentMethodData, formatCurrency } = useCollectionOverview();

    // Calculate percentages
    const total = detailedPaymentMethodData.reduce((sum, item) => sum + item.value, 0);
    const dataWithPercentage = detailedPaymentMethodData.map(item => ({
        ...item,
        percentage: total > 0 ? (item.value / total) * 100 : 0
    }));

    const chartHeight = Math.max(detailedPaymentMethodData.length * 45 + 40, 120);

    const tooltipStyle: React.CSSProperties = {
        borderRadius: "var(--radius)",
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
        fontSize: 12,
        color: "hsl(var(--foreground))",
    };

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <div>
                        <CardTitle className="text-sm font-medium">Payment Method</CardTitle>
                        <CardDescription className="text-xs">Detailed breakdown of collection methods and totals</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Table Section */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent border-b">
                                    <TableHead className="text-[11px] h-9 font-semibold text-foreground">Payment Method</TableHead>
                                    <TableHead className="text-[11px] h-9 font-semibold text-foreground text-right px-4">Amount</TableHead>
                                    <TableHead className="text-[11px] h-9 font-semibold text-foreground text-right w-[60px]">%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dataWithPercentage.map((item, index) => (
                                    <TableRow key={index} className="hover:bg-muted/30 transition-colors border-b last:border-0 h-10">
                                        <TableCell className="py-0">
                                            <div className="flex items-center gap-2.5">
                                                <div 
                                                    className="w-2 h-2 rounded-full flex-shrink-0" 
                                                    style={{ backgroundColor: item.color }} 
                                                />
                                                <span className="text-[12px] font-medium text-foreground whitespace-nowrap">
                                                    {item.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-0 text-right text-[12px] font-bold tabular-nums px-4">
                                            {formatCurrency(item.value)}
                                        </TableCell>
                                        <TableCell className="py-0 text-right text-[12px] text-muted-foreground tabular-nums">
                                            {item.percentage.toFixed(1)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {dataWithPercentage.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-xs text-muted-foreground">
                                            No payment data available
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Chart Section */}
                    <div className="w-full pt-2" style={{ height: `${chartHeight}px` }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={dataWithPercentage}
                                layout="vertical"
                                margin={{ top: 0, right: 60, left: 10, bottom: 20 }}
                                barSize={36}
                                barCategoryGap={8}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    type="number"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                    tickFormatter={(v) => v === 0 ? "₱0" : `₱${(v / 1000000).toFixed(1)}M`}
                                />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    hide
                                />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                                    contentStyle={tooltipStyle}
                                    formatter={(value: number) => [formatCurrency(value), "Amount"]}
                                />
                                <Bar
                                    dataKey="value"
                                    radius={[0, 4, 4, 0]}
                                    animationDuration={1000}
                                >
                                    {dataWithPercentage.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                    <LabelList 
                                        dataKey="value" 
                                        position="right" 
                                        formatter={(v: number) => {
                                            if (v >= 1000000) return `₱${(v / 1000000).toFixed(1)}M`;
                                            if (v >= 1000) return `₱${(v / 1000).toFixed(0)}k`;
                                            return `₱${v.toLocaleString()}`;
                                        }}
                                        style={{ fontSize: '11px', fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                                        offset={12}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
