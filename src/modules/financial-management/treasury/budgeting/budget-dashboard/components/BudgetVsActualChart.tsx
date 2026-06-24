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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

interface BudgetVsActualChartProps {
  data?: { name: string; allocated: number; actual: number }[];
  onDivisionClick?: (divisionName: string) => void;
  title?: string;
}

export function BudgetVsActualChart({ data = [], onDivisionClick, title = "Budget vs Actual by Division" }: BudgetVsActualChartProps) {
  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-[400px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground/70">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0 px-0 pb-4">
        <div className="w-full h-full overflow-x-auto overflow-y-hidden px-6 scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <div style={{ minWidth: `${Math.max(data.length * 100, 300)}px`, height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                barGap={8}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="name" 
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
                  width={60}
                />
                <Tooltip 
                  cursor={{ fill: "rgba(0,0,0,0.02)" }}
                  contentStyle={{ 
                    borderRadius: "16px", 
                    border: "none", 
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                    fontWeight: "bold"
                  }}
                  formatter={(value: number) => [formatCurrency(value), ""]}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  wrapperStyle={{ fontSize: "10px", fontWeight: "black", textTransform: "uppercase", letterSpacing: "1px", paddingBottom: "20px" }}
                />
                <Bar 
                  dataKey="allocated" 
                  name="Allocated" 
                  fill="hsl(var(--primary))" 
                  radius={[6, 6, 0, 0]} 
                  barSize={24}
                  className={onDivisionClick ? "cursor-pointer" : ""}
                  onClick={(data: { name?: string }) => {
                    if (onDivisionClick && data?.name) onDivisionClick(data.name);
                  }}
                />
                <Bar 
                  dataKey="actual" 
                  name="Actual" 
                  fill="#0D9488" 
                  radius={[6, 6, 0, 0]} 
                  barSize={24}
                  className={onDivisionClick ? "cursor-pointer" : ""}
                  onClick={(data: { name?: string }) => {
                    if (onDivisionClick && data?.name) onDivisionClick(data.name);
                  }}
                >
                  {data.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.actual > entry.allocated ? "#EF4444" : "#0D9488"} 
                      />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
