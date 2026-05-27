"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Landmark, Tags, Briefcase, Zap, Package } from "lucide-react";

interface TopCategoriesProps {
  matrixData: { department: string; [category: string]: number | string }[];
}

export function TopExpenseCategoriesCard({ matrixData }: TopCategoriesProps) {
  const categoryTotals: Record<string, number> = {};

  matrixData.forEach(row => {
    Object.entries(row).forEach(([key, val]) => {
      if (key !== "department") {
        categoryTotals[key] = (categoryTotals[key] || 0) + Number(val || 0);
      }
    });
  });

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3); // Get top 3

  const formatCurrency = (val: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  // Find max for progress bar
  const maxAmount = sortedCategories.length > 0 ? sortedCategories[0][1] : 1;

  const getCategoryIcon = (name: string, index: number) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("tax") || lowerName.includes("revenue")) return <Landmark className="w-4 h-4 text-rose-500" />;
    if (lowerName.includes("inventor")) return <Package className="w-4 h-4 text-emerald-500" />;
    if (lowerName.includes("utilit")) return <Zap className="w-4 h-4 text-amber-500" />;
    if (lowerName.includes("fee") || lowerName.includes("prof")) return <Briefcase className="w-4 h-4 text-indigo-500" />;
    
    // Fallbacks based on rank
    if (index === 0) return <Tags className="w-4 h-4 text-sky-500" />;
    if (index === 1) return <Tags className="w-4 h-4 text-emerald-500" />;
    return <Tags className="w-4 h-4 text-amber-500" />;
  };

  return (
    <Card className="shadow-none border-border/40 bg-card h-full min-h-[400px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <PieChart className="w-3 h-3 text-sky-500" /> Top 3 Expense Categories
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 mt-3">
        {sortedCategories.length > 0 ? (
          sortedCategories.map(([name, amount], idx) => {
            const percent = (amount / maxAmount) * 100;
            return (
              <div key={name || idx} className="flex flex-col gap-2 group cursor-default">
                <div className="flex items-center justify-between transition-transform duration-300 group-hover:-translate-y-0.5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-muted/60 border border-border/50 group-hover:shadow-sm transition-shadow">
                      {getCategoryIcon(name, idx)}
                    </div>
                    <span className="text-sm font-bold text-foreground truncate max-w-[180px] group-hover:text-primary transition-colors">{name}</span>
                  </div>
                  <span className="text-sm font-black text-foreground">{formatCurrency(amount)}</span>
                </div>
                {/* Sleek Progress Bar */}
                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${idx === 0 ? 'bg-sky-500' : idx === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.max(2, percent)}%` }} 
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm font-medium text-muted-foreground">No expenses recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
