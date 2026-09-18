"use client";

import React from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Cell
} from "recharts";
import { Card } from "@/components/ui/card";
import { Building2, TrendingUp } from "lucide-react";

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

interface BudgetVsActualChartProps {
  data?: { name: string; allocated: number; actual: number }[];
  onDivisionClick?: (divisionName: string) => void;
  title?: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    const allocated = payload.find(p => p.name === "Allocated")?.value || 0;
    const actual = payload.find(p => p.name === "Actual")?.value || 0;
    const diff = allocated - actual;
    const isOverBudget = actual > allocated && allocated > 0;
    const utilization = allocated > 0 ? ((actual / allocated) * 100).toFixed(1) : "0.0";

    return (
      <div className="bg-background/95 backdrop-blur-md border border-border/60 p-3.5 rounded-2xl shadow-xl text-xs flex flex-col gap-2 min-w-[190px]">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="font-black uppercase tracking-wider text-foreground">{label}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isOverBudget ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
          }`}>
            {utilization}% Utilized
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
              <div className="w-2.5 h-2.5 rounded-full bg-teal-600 shrink-0" />
              <span className="text-muted-foreground font-medium">Actual Spent:</span>
            </div>
            <span className={`font-extrabold ${isOverBudget ? "text-rose-500" : "text-teal-600 dark:text-teal-400"}`}>
              {formatCurrencyFull(actual)}
            </span>
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

export function BudgetVsActualChart({ data = [], onDivisionClick, title = "Budget vs Actual by Division" }: BudgetVsActualChartProps) {
  const topDivision = [...data].sort((a, b) => b.allocated - a.allocated)[0];

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-full min-h-[400px] flex flex-col group p-0">
      {/* Header Section */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0 z-10 border-b border-border/30 bg-muted/5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground leading-none">
              {title}
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Comparative allocation & spend per division
            </p>
          </div>
        </div>

        {topDivision && (
          <div className="hidden sm:flex items-center gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-blue-500/20">
            <TrendingUp className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[90px]">{topDivision.name}</span>
            <span className="font-black">({formatCurrencyCompact(topDivision.allocated)})</span>
          </div>
        )}
      </div>

      {/* Main Bar Chart Container */}
      <div className="flex-1 min-h-0 pt-3 px-4 pb-4 flex flex-col justify-between">
        <div className="w-full flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <div style={{ minWidth: `${Math.max(data.length * 90, 280)}px`, height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 15, right: 10, left: -10, bottom: 0 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(140,140,140,0.12)" />
                <XAxis 
                  dataKey="name" 
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
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", paddingBottom: "12px" }}
                />
                <Bar 
                  dataKey="allocated" 
                  name="Allocated" 
                  fill="#2563EB" 
                  radius={[6, 6, 0, 0]} 
                  barSize={20}
                  className={onDivisionClick ? "cursor-pointer" : ""}
                  onClick={(entry: { name?: string }) => {
                    if (onDivisionClick && entry?.name) onDivisionClick(entry.name);
                  }}
                />
                <Bar 
                  dataKey="actual" 
                  name="Actual" 
                  radius={[6, 6, 0, 0]} 
                  barSize={20}
                  className={onDivisionClick ? "cursor-pointer" : ""}
                  onClick={(entry: { name?: string }) => {
                    if (onDivisionClick && entry?.name) onDivisionClick(entry.name);
                  }}
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.actual > entry.allocated && entry.allocated > 0 ? "#F43F5E" : "#0D9488"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  );
}
