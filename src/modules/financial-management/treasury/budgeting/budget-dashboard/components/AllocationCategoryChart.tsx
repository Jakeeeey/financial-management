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
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={8}
        className="transition-all duration-300 drop-shadow-lg outline-none"
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
    percent: total > 0 ? (Number(d.value) / total * 100).toFixed(2) : "0.00",
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
      percent: total > 0 ? (Number(d.value) / total * 100).toFixed(2) : "0.00",
      fill,
      isOther: chartItemIndex === -1
    };
  });

  // Track hovered state
  let activeChartData = null;
  if (activeIndex !== null) {
    const hoveredLegend = legendData[activeIndex];
    if (hoveredLegend.isOther) {
       activeChartData = chartData.find(d => d.name === "Others") || null;
    } else {
       activeChartData = chartData.find(d => d.name === hoveredLegend.name) || null;
    }
  }

  const activePieIndex = activeChartData ? chartData.findIndex(d => d.name === activeChartData.name) : undefined;

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-full min-h-[400px] flex flex-col group p-0">
      <div className="px-6 pt-4 pb-0 shrink-0 z-10">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 m-0 leading-none">
          Allocation by Account
        </h3>
      </div>
      <div className="flex-1 min-h-0 flex flex-col mt-0">
        {/* Chart Section - Stacked Top */}
        <div className="w-full h-[250px] relative shrink-0 flex items-center justify-center py-3 -mt-4">
          {/* Dynamic Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 px-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground truncate max-w-[110px] text-center mt-2">
              {activeChartData ? activeChartData.name : "Total"}
            </span>
          </div>

          <ResponsiveContainer width="100%" height="100%" className="focus:outline-none">
            <PieChart className="focus:outline-none [&_.recharts-pie-sector]:outline-none [&_.recharts-sector]:outline-none [&_path]:outline-none" style={{ outline: "none" }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="65%"
                outerRadius="90%"
                paddingAngle={4}
                cornerRadius={8}
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
                labelLine={false}
                label={(props) => {
                  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
                  const RADIAN = Math.PI / 180;
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  
                  if (Number(percent) < 5) return null;

                  return (
                    <text 
                      x={x} 
                      y={y} 
                      fill="#fff" 
                      textAnchor="middle" 
                      dominantBaseline="central"
                      className="text-[8.5px] font-bold pointer-events-none drop-shadow-md outline-none"
                    >
                      {percent}%
                    </text>
                  );
                }}
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

        {/* Compact Legend Panel - Stacked Bottom */}
        <div className="w-full flex-1 border-t border-border/40 bg-muted/10 px-6 pt-3 pb-2 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
              Account Details
            </h4>
            <span className="text-[9px] font-bold text-muted-foreground/40 whitespace-nowrap">{legendData.length} items</span>
          </div>
          {/* Native scroll container to guarantee scrolling works */}
          <div className="flex-1 overflow-y-auto pr-3 -mr-3 scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <div className="flex flex-col gap-1.5 pb-2">
              {legendData.map((item, index) => (
                <div 
                  key={item.name || index}
                  id={`allocation-legend-item-${index}`}
                  className={`flex items-center justify-between p-2 rounded-lg transition-all cursor-pointer ${
                    activeIndex === index 
                      ? "bg-background shadow-sm border border-border/60 scale-[1.01]" 
                      : "hover:bg-muted/60 border border-transparent"
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
                  <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                    <div 
                      className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${item.isOther ? 'ring-1 ring-border/50' : ''}`}
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-[10px] font-bold uppercase truncate text-foreground group-hover:text-primary transition-colors">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-2 flex gap-3 items-center">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {formatCurrency(item.value)}
                    </span>
                    <span 
                      className="text-[10px] font-black text-white px-2 py-0.5 rounded-md shadow-sm min-w-[48px] text-center shrink-0"
                      style={{ backgroundColor: item.fill }}
                    >
                      {item.percent}%
                    </span>
                  </div>
                </div>
              ))}
              {legendData.length === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-4 italic font-medium">
                  No data
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
