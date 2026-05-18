"use client";

import React from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export function MonthlyTrendChart({ data = [] }: { data?: { month: string; amount: number }[] }) {
  // Map raw data (Full Month Names) to the chart format (Abbr)
  const chartData = MONTH_ABBR.map((abbr, index) => {
    const fullName = FULL_MONTH_NAMES[index];
    const match = data.find(d => d.month === fullName);
    return {
      month: abbr,
      amount: match ? match.amount : 0
    };
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-[400px] flex flex-col lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground/70">
          Monthly Approved Budget
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={formatCurrency}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: "16px", 
                border: "none", 
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                fontSize: "12px",
                fontWeight: "bold"
              }}
              formatter={(value: number) => [formatCurrency(value), "Approved Amount"]}
            />
            <Area 
              type="monotone" 
              dataKey="amount" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorUtil)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
