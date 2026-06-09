"use client";

import React, { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  RefreshCw,
  FileText,
  Calendar,
  TrendingUp,
  AlertCircle,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCashFlowStatement } from "./hooks/useCashFlowStatement";
import { CashFlowSummary } from "./components/CashFlowSummary";
import { CashFlowTable } from "./components/CashFlowTable";
import { CashFlowAIInsights } from "./components/CashFlowAIInsights";
import { useCashFlowAI } from "./hooks/useCashFlowAI";

export default function CashFlowStatementModule() {
  const {
    groupedEntries,
    summary,
    entries,
    isLoading,
    error,
    filters,
    setStartDate,
    setEndDate,
    refresh,
  } = useCashFlowStatement();

  // Only re-initialize AI hook when entries actually change (reference equality)
  const aiOptions = useMemo(
    () => ({
      entries,
      summary,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    [entries, summary, filters.startDate, filters.endDate]
  );

  const {
    insight,
    isAnalyzing,
    error: aiError,
    hasRun,
    analyze: analyzeWithAI,
  } = useCashFlowAI(aiOptions);

  // Memoized date computations (avoid recreating on every render)
  const dates = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const firstDayOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString().split("T")[0];
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
    return { today, firstDayOfMonth, startOfYear };
  }, []);

  const handleThisMonth = useCallback(() => {
    setStartDate(dates.firstDayOfMonth);
    setEndDate(dates.today);
  }, [dates.firstDayOfMonth, dates.today, setStartDate, setEndDate]);

  const handleThisYear = useCallback(() => {
    setStartDate(dates.startOfYear);
    setEndDate(dates.today);
  }, [dates.startOfYear, dates.today, setStartDate, setEndDate]);

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto min-h-screen" style={{ background: 'linear-gradient(180deg, hsl(var(--muted) / 0.15) 0%, transparent 600px)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b border-border/50">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.2)] shrink-0">
            <TrendingUp className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground">
              Statement of Cash Flows
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1 tracking-wide">
              Analyze cash movements across operating, investing, and financing activities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
            className="h-10 px-4 text-xs font-bold uppercase tracking-widest bg-background/50 backdrop-blur-sm border-border/50 hover:bg-muted/50 transition-all"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
                Start Date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 h-10 text-xs font-bold uppercase bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-emerald-500/30 focus-visible:bg-background rounded-xl transition-all"
                />
              </div>
            </div>
            <div className="flex-1 w-full space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
                End Date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={dates.today}
                  className="pl-10 h-10 text-xs font-bold uppercase bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-emerald-500/30 focus-visible:bg-background rounded-xl transition-all"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleThisMonth}
                className="h-10 px-4 text-[10px] font-black uppercase tracking-widest"
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleThisYear}
                className="h-10 px-4 text-[10px] font-black uppercase tracking-widest"
              >
                This Year
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-rose-500/50 bg-rose-50 dark:bg-rose-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <CashFlowSummary
        operatingActivities={summary.operatingActivities}
        investingActivities={summary.investingActivities}
        financingActivities={summary.financingActivities}
        netIncreaseInCash={summary.netIncreaseInCash}
        isLoading={isLoading}
      />

      {/* AI-Powered Insights */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-indigo-500" />
            </div>
            <h2 className="text-lg font-bold uppercase tracking-tight">
              AI Insights
            </h2>
          </div>
          <CashFlowAIInsights
            insight={insight}
            isAnalyzing={isAnalyzing}
            hasRun={hasRun}
            onAnalyze={analyzeWithAI}
            error={aiError}
          />
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-bold uppercase tracking-tight">
              Transaction Details
            </h2>
          </div>
          <CashFlowTable
            groupedEntries={groupedEntries}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}