"use client";

import React, { useState } from "react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Sector
} from "recharts";
import { Card } from "@/components/ui/card";
import { PieChart as PieIcon, TrendingUp, Trophy } from "lucide-react";

// Expanded High contrast premium colors
const COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#F43F5E", 
  "#06B6D4", "#14B8A6", "#EC4899", "#84CC16", "#6366F1",
  "#D946EF", "#EAB308", "#3B82F6", "#10B981", "#F97316",
  "#A855F7", "#EF4444", "#0EA5E9", "#84CC16", "#64748B"
];
const OTHERS_COLOR = "#94A3B8"; // Slate Gray for "Others"

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
};

// Custom shape for dynamic hover effect
interface ActiveShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
}

const renderActiveShape = (props: unknown) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props as ActiveShapeProps;
  return (
    <g style={{ outline: "none" }}>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={6}
        className="transition-all duration-300 drop-shadow-md outline-none"
        style={{ outline: "none" }}
      />
    </g>
  );
};

export function AllocationCategoryChart({ data = [] }: { data?: { name: string; value: number }[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  // 1. Sort data by value (descending)
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  // 2. Aggregate Top 5 + "Others" for the Pie Chart ONLY
  const topN = 5;
  const hasOthers = sortedData.length > topN;
  const chartDataRaw = hasOthers ? sortedData.slice(0, topN) : sortedData;
  const othersValue = hasOthers ? sortedData.slice(topN).reduce((acc, curr) => acc + curr.value, 0) : 0;
  
  if (hasOthers && othersValue > 0) {
    chartDataRaw.push({ name: "Others", value: othersValue });
  }

  // Pre-calculate percentages and colors for Chart Data
  const chartData = chartDataRaw.map((d, index) => ({
    ...d,
    percent: total > 0 ? (Number(d.value) / total * 100).toFixed(1) : "0.0",
    fill: d.name === "Others" ? OTHERS_COLOR : COLORS[index % COLORS.length]
  }));

  // Map ALL data for the Legend Panel
  const legendData = sortedData.map((d, index) => {
    let fill = OTHERS_COLOR;
    const chartItemIndex = chartData.findIndex(cd => cd.name === d.name);
    if (chartItemIndex !== -1) {
      fill = chartData[chartItemIndex].fill;
    } else {
      fill = COLORS[(topN + index) % COLORS.length]; 
    }

    return {
      ...d,
      percentRaw: total > 0 ? (Number(d.value) / total * 100) : 0,
      percent: total > 0 ? (Number(d.value) / total * 100).toFixed(1) : "0.0",
      fill,
      isOther: chartItemIndex === -1
    };
  });

  // Track hovered state
  let activeChartData = null;
  let activeLegendItem: typeof legendData[0] | null = null;
  if (activeIndex !== null && legendData[activeIndex]) {
    activeLegendItem = legendData[activeIndex];
    const legendItemName = activeLegendItem.name;
    if (activeLegendItem.isOther) {
       activeChartData = chartData.find(d => d.name === "Others") || null;
    } else {
       activeChartData = chartData.find(d => d.name === legendItemName) || null;
    }
  }

  const activePieIndex = activeChartData ? chartData.findIndex(d => d.name === activeChartData.name) : undefined;
  const topAccount = legendData.length > 0 ? legendData[0] : null;

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-full min-h-[440px] flex flex-col group p-0">
      {/* Header Section */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0 z-10 border-b border-border/30 bg-muted/5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
            <PieIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground leading-none">
              Allocation by Account
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Budget breakdown by chart of account
            </p>
          </div>
        </div>

        {topAccount && (
          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-500/20">
            <TrendingUp className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[100px]">{topAccount.name}</span>
            <span className="font-black">({topAccount.percent}%)</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Chart Section */}
        <div className="w-full h-[200px] relative shrink-0 flex items-center justify-center py-2">
          {/* Enhanced Center KPI Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 px-8 text-center">
            <span 
              className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/80 line-clamp-2 max-w-[120px] leading-tight transition-colors"
              title={activeLegendItem ? activeLegendItem.name : "Total Allocation"}
            >
              {activeLegendItem ? activeLegendItem.name : "Total Allocation"}
            </span>
            <span className="text-sm font-black tracking-tight text-foreground mt-0.5 transition-all">
              {activeLegendItem 
                ? formatCurrency(activeLegendItem.value)
                : formatCurrency(total)}
            </span>
            {activeLegendItem && (
              <span 
                className="text-[9px] font-extrabold px-2 py-0.5 rounded-full text-white mt-0.5 shadow-xs transition-all"
                style={{ backgroundColor: activeLegendItem.fill }}
              >
                {activeLegendItem.percent}% of Total
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height="100%" className="focus:outline-none">
            <PieChart style={{ outline: "none" }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="68%"
                outerRadius="88%"
                paddingAngle={3}
                cornerRadius={6}
                dataKey="value"
                stroke="none"
                activeIndex={activePieIndex}
                activeShape={renderActiveShape}
                onClick={(_, index) => {
                  const name = chartData[index].name;
                  if (name !== "Others") {
                    const legIdx = legendData.findIndex(l => l.name === name);
                    if (legIdx !== -1) {
                      setActiveIndex(legIdx);
                      document.getElementById(`allocation-legend-item-${legIdx}`)?.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest' 
                      });
                    }
                  }
                }}
                onMouseEnter={(_, index) => {
                  const name = chartData[index].name;
                  if (name === "Others") {
                    setActiveIndex(null); 
                  } else {
                    const legIdx = legendData.findIndex(l => l.name === name);
                    setActiveIndex(legIdx !== -1 ? legIdx : null);
                  }
                }}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.fill} 
                    className="transition-all duration-300 outline-none focus:outline-none cursor-pointer"
                    style={{ outline: "none" }}
                    tabIndex={-1}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Streamlined Account Details / Legend Panel */}
        <div className="w-full flex-1 border-t border-border/40 bg-muted/10 px-4 pt-3 pb-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0 px-1">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">
              Account Details
            </h4>
            <span className="text-[10px] font-bold text-muted-foreground/60 bg-background border border-border/50 px-2 py-0.5 rounded-full">
              {legendData.length} {legendData.length === 1 ? 'account' : 'accounts'}
            </span>
          </div>

          {/* Scrollable Compact Account List */}
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <div className="flex flex-col gap-1.5 pb-1">
              {legendData.map((item, index) => {
                const isSelected = activeIndex === index;
                const isTop1 = index === 0;

                return (
                  <div 
                    key={item.name || index}
                    id={`allocation-legend-item-${index}`}
                    className={`group/item relative overflow-hidden flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer border ${
                      isSelected 
                        ? "bg-background shadow-md border-primary/50 translate-x-1" 
                        : isTop1
                          ? "bg-background/80 border-primary/20 shadow-xs"
                          : "bg-background/40 hover:bg-background border-border/30 hover:border-border/60"
                    }`}
                    onClick={() => {
                      setActiveIndex(index);
                      document.getElementById(`allocation-legend-item-${index}`)?.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest' 
                      });
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {/* Background Progress Bar Fill Accent */}
                    <div 
                      className="absolute inset-y-0 left-0 opacity-[0.07] pointer-events-none transition-all duration-500 rounded-xl"
                      style={{ 
                        width: `${Math.max(item.percentRaw, 3)}%`,
                        backgroundColor: item.fill 
                      }}
                    />

                    {/* Left Rank Dot / Accent Strip */}
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0 z-10">
                      <div 
                        className="w-1.5 h-6 rounded-full shrink-0 transition-transform group-hover/item:scale-110"
                        style={{ backgroundColor: item.fill }}
                      />
                      
                      {isTop1 && (
                        <Trophy className="h-3 w-3 text-amber-500 shrink-0" />
                      )}

                      <span 
                        className={`text-[11px] uppercase truncate transition-colors ${
                          isTop1 ? "font-black text-foreground" : "font-bold text-foreground/90 group-hover/item:text-primary"
                        }`}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    </div>

                    {/* Right Amount & Percent Badge */}
                    <div className="text-right shrink-0 flex items-center gap-2 z-10 ml-2">
                      <span className="text-[11px] font-extrabold text-foreground tracking-tight">
                        {formatCurrency(item.value)}
                      </span>
                      <span 
                        className="text-[9.5px] font-black text-white px-2 py-0.5 rounded-lg shadow-xs min-w-[42px] text-center shrink-0"
                        style={{ backgroundColor: item.fill }}
                      >
                        {item.percent}%
                      </span>
                    </div>
                  </div>
                );
              })}

              {legendData.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6 italic font-medium">
                  No account allocation data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
