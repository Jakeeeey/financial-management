"use client";

import React, { useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Using a distinct color palette for the stacked categories
const CATEGORY_COLORS = [
  "#0ea5e9", // sky 500
  "#8b5cf6", // violet 500
  "#ec4899", // pink 500
  "#f59e0b", // amber 500
  "#10b981", // emerald 500
  "#f43f5e", // rose 500
  "#64748b", // slate 500
  "#14b8a6", // teal 500
  "#d946ef", // fuchsia 500
  "#84cc16", // lime 500
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

interface ExpenseCategoryHeatmapProps {
  data: { department: string; [category: string]: number | string }[];
}

export function ExpenseCategoryHeatmap({ data }: ExpenseCategoryHeatmapProps) {
  // Dynamically extract all unique categories present across all departments
  const categories = useMemo(() => {
    const cats = new Set<string>();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== "department") {
          cats.add(key);
        }
      });
    });
    return Array.from(cats);
  }, [data]);

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-full min-h-[400px] flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground/70">
          Expense Category Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0 px-2 pb-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm font-medium text-muted-foreground/50">
            No expense data found.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis 
                dataKey="department" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value) => formatCurrency(value)}
                dx={-10}
              />
              <Tooltip 
                cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                contentStyle={{ 
                  borderRadius: "16px", 
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
              />
              <Legend 
                wrapperStyle={{ fontSize: "10px", fontWeight: "bold", paddingTop: "10px" }}
                iconType="circle"
                iconSize={8}
              />
              {categories.map((cat, index) => (
                <Bar 
                  key={cat}
                  dataKey={cat} 
                  stackId="a" 
                  fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} 
                  radius={index === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                  barSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
