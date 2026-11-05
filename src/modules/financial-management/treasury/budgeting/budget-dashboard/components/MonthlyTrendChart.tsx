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
import { Card } from "@/components/ui/card";
import { TrendingUp, Calendar, ArrowUpRight } from "lucide-react";

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

const formatCurrencyCompact = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

const formatCurrencyFull = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
};

// Custom Tooltip component
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    const allocated = payload.find(p => p.name === "Allocated Budget")?.value || 0;
    const actual = payload.find(p => p.name === "Actual Spent")?.value || 0;
    const diff = allocated - actual;
    const isOverBudget = actual > allocated && allocated > 0;

    return (
      <div className="bg-background/95 backdrop-blur-md border border-border/60 p-3.5 rounded-2xl shadow-xl text-xs flex flex-col gap-2 min-w-[190px]">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="font-black uppercase tracking-wider text-foreground">{label}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isOverBudget ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
          }`}>
            {isOverBudget ? "Over Budget" : "Within Budget"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 pt-0.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
              <span className="text-muted-foreground font-medium">Allocated:</span>
            </div>
            <span className="font-extrabold text-foreground">{formatCurrencyFull(allocated)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-muted-foreground font-medium">Actual Spent:</span>
            </div>
            <span className="font-extrabold text-rose-500">{formatCurrencyFull(actual)}</span>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-border/30">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Variance:</span>
            <span className={`font-black text-[11px] ${diff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {diff >= 0 ? `+${formatCurrencyFull(diff)}` : formatCurrencyFull(diff)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function MonthlyTrendChart({ data = [], onMonthClick, year }: MonthlyTrendChartProps) {
  // Map raw data (Full Month Names) to the chart format (Abbr)
  const chartData = MONTH_ABBR.map((abbr, index) => {
    const fullName = FULL_MONTH_NAMES[index];
    const match = data.find(d => d.month === fullName);
    return {
      month: abbr,
      fullName,
      monthNumber: String(index + 1),
      amount: match ? match.amount : 0,
      actual: match ? (match.actual || 0) : 0
    };
  });

  const totalAllocated = chartData.reduce((acc, curr) => acc + curr.amount, 0);
  const totalActual = chartData.reduce((acc, curr) => acc + curr.actual, 0);
  const overallUtilization = totalAllocated > 0 ? (totalActual / totalAllocated * 100).toFixed(1) : "0.0";

  const handleChartClick = (state: { activePayload?: { payload: { monthNumber: string } }[] }) => {
    if (state && state.activePayload && state.activePayload.length > 0 && onMonthClick) {
      const clickedData = state.activePayload[0].payload;
      onMonthClick(clickedData.monthNumber);
    }
  };

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-full min-h-[440px] flex flex-col group p-0">
      {/* Header Section */}
      <div className="px-6 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 z-10 border-b border-border/30 bg-muted/5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground leading-none">
                Budget vs Actual Monthly Trend
              </h3>
              {year && (
                <span className="text-[10px] font-bold text-muted-foreground bg-background border border-border/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {year}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Monthly comparative performance trajectory
            </p>
          </div>
        </div>

        {/* Executive Metric Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex flex-col px-3 py-1 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400">Allocated</span>
            <span className="text-xs font-black text-foreground leading-none">{formatCurrencyCompact(totalAllocated)}</span>
          </div>
          <div className="flex flex-col px-3 py-1 rounded-xl bg-rose-500/5 border border-rose-500/15">
            <span className="text-[9px] font-black uppercase text-rose-500">Actual Spent</span>
            <span className="text-xs font-black text-foreground leading-none">{formatCurrencyCompact(totalActual)}</span>
          </div>
          <div className="flex flex-col px-3 py-1 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Utilized</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 leading-none">{overallUtilization}%</span>
          </div>
        </div>
      </div>

      {/* Main Chart Content */}
      <div className="flex-1 min-h-0 p-5 pt-3 flex flex-col justify-between">
        <div className="w-full flex-1 min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
              onClick={handleChartClick}
              className={onMonthClick ? "cursor-pointer" : ""}
            >
              <defs>
                <linearGradient id="colorBudgetGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01}/>
                </linearGradient>
                <linearGradient id="colorActualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(140,140,140,0.12)" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 800, fill: "hsl(var(--muted-foreground))" }}
                dy={8}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 800, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={formatCurrencyCompact}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: "11px", fontWeight: "800", paddingTop: "12px" }}
                iconType="circle"
                iconSize={8}
              />
              <Area 
                type="monotone" 
                dataKey="amount"
                name="Allocated Budget" 
                stroke="#2563EB" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorBudgetGradient)" 
                activeDot={{ r: 6, strokeWidth: 2, stroke: "#ffffff" }}
              />
              <Area 
                type="monotone" 
                dataKey="actual"
                name="Actual Spent" 
                stroke="#F43F5E" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorActualGradient)"
                activeDot={{ r: 6, strokeWidth: 2, stroke: "#ffffff" }} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Helper Footer Hint */}
        {onMonthClick && (
          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/30 text-[10px] font-bold text-muted-foreground/60">
            <span>💡 Click any month point to filter dashboard data</span>
            <ArrowUpRight className="h-3 w-3" />
          </div>
        )}
      </div>
    </Card>
  );
}
