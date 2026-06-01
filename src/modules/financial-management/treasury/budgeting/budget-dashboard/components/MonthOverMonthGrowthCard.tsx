"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, Activity } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { budgetDashboardService } from "../services/budgetDashboardService";
import { MONTH_NAMES } from "../../budget-approval/utils";

interface MoMProps {
  trendData?: { month: string; amount: number }[]; // kept for compatibility, but we fetch actuals
  currentMonthNumber: string;
  divisionId?: string;
}

export function MonthOverMonthGrowthCard({ currentMonthNumber, divisionId, trendData = [] }: MoMProps) {
  const [currentAmt, setCurrentAmt] = useState(0);
  const [prevAmt, setPrevAmt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActuals() {
      setLoading(true);
      try {
        const year = String(new Date().getFullYear());
        const currMonthName = MONTH_NAMES[Number(currentMonthNumber) - 1];
        
        // Find previous month
        let prevMonthName = "";
        let prevYear = year;
        if (Number(currentMonthNumber) === 1) {
          prevMonthName = MONTH_NAMES[11];
          prevYear = String(Number(year) - 1);
        } else {
          prevMonthName = MONTH_NAMES[Number(currentMonthNumber) - 2];
        }

        // We can reuse getMetrics to get actual utilized for a specific month
        const [currMetrics, prevMetrics] = await Promise.all([
          budgetDashboardService.getMetrics({ year, month: currMonthName, division_id: divisionId }),
          budgetDashboardService.getMetrics({ year: prevYear, month: prevMonthName, division_id: divisionId })
        ]);

        setCurrentAmt(currMetrics.utilized || 0);
        setPrevAmt(prevMetrics.utilized || 0);
      } catch (err) {
        console.error("MoM Fetch Error", err);
      } finally {
        setLoading(false);
      }
    }
    fetchActuals();
  }, [currentMonthNumber, divisionId]);

  const diff = currentAmt - prevAmt;
  const percentChange = prevAmt > 0 ? (diff / prevAmt) * 100 : (currentAmt > 0 ? 100 : 0);
  
  const formatCurrency = (val: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  return (
    <Card className="shadow-none border-border/40 relative overflow-hidden h-full min-h-[400px] group bg-gradient-to-br from-background to-muted/30">
      {/* Watermark Icon */}
      <div className="absolute -right-6 -bottom-6 opacity-[0.03] pointer-events-none transition-transform duration-700 group-hover:scale-110">
        <Activity className="w-48 h-48" />
      </div>

      <CardHeader className="pb-2 relative z-10">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <TrendingUp className="w-3 h-3 text-emerald-500" /> MoM Growth Comparison
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex flex-col gap-1 justify-center h-[calc(100%-40px)] relative z-10">
        {loading ? (
          <div className="animate-pulse flex flex-col gap-2">
            <div className="h-10 bg-muted rounded w-3/4"></div>
            <div className="h-6 bg-muted rounded w-1/2"></div>
          </div>
        ) : (
          <div className="flex flex-col h-full justify-between pb-2">
            <div>
              <p className="text-4xl lg:text-5xl font-black tracking-tighter text-foreground drop-shadow-sm">{formatCurrency(currentAmt)}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {percentChange > 0 ? (
                  <div className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-500/15 px-2.5 py-1 rounded-md border border-rose-500/20">
                    <ArrowUpRight className="w-3 h-3" /> +{percentChange.toFixed(2)}%
                  </div>
                ) : percentChange < 0 ? (
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/15 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    <ArrowDownRight className="w-3 h-3" /> {percentChange.toFixed(2)}%
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
                    <Minus className="w-3 h-3" /> 0.00%
                  </div>
                )}
                <span className="text-[11px] font-medium text-muted-foreground">vs previous ({formatCurrency(prevAmt)})</span>
              </div>
            </div>

            {/* Sparkline Chart */}
            {trendData && trendData.length > 0 && (
              <div className="h-16 w-full mt-4 -mx-2 opacity-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={percentChange <= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={percentChange <= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke={percentChange <= 0 ? "#10b981" : "#f43f5e"} 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#sparkGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
