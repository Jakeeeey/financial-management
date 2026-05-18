"use client";

import React from "react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const COLORS = [
  "#0D9488", "#0891B2", "#2563EB", "#4F46E5", "#7C3AED", 
  "#9333EA", "#C026D3", "#DB2777", "#E11D48", "#EA580C"
];

export function AllocationCategoryChart({ data = [] }: { data?: { name: string; value: number }[] }) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-[400px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground/70">
          Allocation by Account
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip 
              contentStyle={{ 
                borderRadius: "16px", 
                border: "none", 
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                fontSize: "12px",
                fontWeight: "bold"
              }}
              formatter={(value: number) => {
                const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return [`${formatCurrency(value)} (${percent}%)`, "Share"];
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              align="center" 
              iconType="circle"
              wrapperStyle={{ fontSize: "8px", fontWeight: "bold", textTransform: "uppercase", paddingTop: "10px" }}
              layout="horizontal"
            />
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
