"use client";

import React from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

interface MonthlyTrendChartProps {
  data?: { month: string; amount: number; actual?: number }[];
  onMonthClick?: (monthNumber: string) => void;
  year?: string;
}

export function MonthlyTrendChart({ data = [], onMonthClick, year }: MonthlyTrendChartProps) {
  // Map raw data (Full Month Names) to the chart format (Abbr)
  const chartData = MONTH_ABBR.map((abbr, index) => {
    const fullName = FULL_MONTH_NAMES[index];
    const match = data.find(d => d.month === fullName);
    return {
      month: abbr,
      monthNumber: String(index + 1), // Pass month number to callback
      amount: match ? match.amount : 0,
      actual: match ? (match.actual || 0) : 0
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

  const handleChartClick = (state: { activePayload?: { payload: { monthNumber: string } }[] }) => {
    if (state && state.activePayload && state.activePayload.length > 0 && onMonthClick) {
      const clickedData = state.activePayload[0].payload;
      onMonthClick(clickedData.monthNumber);
    }
  };

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-full min-h-[400px] flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground/70">
          Budget vs Actual Monthly Trend{year ? ` (${year})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 10, bottom: 0 }}
            onClick={handleChartClick}
            className={onMonthClick ? "cursor-pointer" : ""}
          >
            <defs>
              <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
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
              formatter={(value: number, name: string) => [
                new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value), 
                name === "amount" ? "Allocated Budget" : "Actual Spent"
              ]}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "black", marginBottom: "8px" }}
            />
            <Legend 
               wrapperStyle={{ fontSize: "10px", fontWeight: "bold", paddingTop: "10px" }}
               iconType="circle"
               iconSize={8}
            />
            <Area 
              type="monotone" 
              dataKey="amount"
              name="Allocated Budget" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorBudget)" 
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Area 
              type="monotone" 
              dataKey="actual"
              name="Actual Spent" 
              stroke="#f43f5e" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorActual)"
              activeDot={{ r: 6, strokeWidth: 0 }} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
