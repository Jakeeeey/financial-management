"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Brain,
  AlertTriangle,
  ShieldCheck,
  Lightbulb,
  TrendingUp,
  Loader2,
  RefreshCw,
  ArrowRight,
  BarChart3,
  Activity,
  DollarSign,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIInsight } from "../services/ai-cash-flow.service";

interface CashFlowAIInsightsProps {
  insight: AIInsight | null;
  isAnalyzing: boolean;
  hasRun: boolean;
  onAnalyze: () => void;
  error?: string | null;
}

export function CashFlowAIInsights({
  insight,
  isAnalyzing,
  hasRun,
  onAnalyze,
  error,
}: CashFlowAIInsightsProps) {
  const getHealthConfig = (status: string) => {
    switch (status) {
      case "healthy":
        return {
          icon: ShieldCheck,
          label: "Healthy",
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/30",
          gradient: "from-emerald-500/20 to-emerald-500/5",
          badge: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        };
      case "caution":
        return {
          icon: AlertTriangle,
          label: "Caution",
          color: "text-amber-500",
          bg: "bg-amber-500/10",
          border: "border-amber-500/30",
          gradient: "from-amber-500/20 to-amber-500/5",
          badge: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
        };
      case "critical":
        return {
          icon: AlertTriangle,
          label: "Critical",
          color: "text-rose-500",
          bg: "bg-rose-500/10",
          border: "border-rose-500/30",
          gradient: "from-rose-500/20 to-rose-500/5",
          badge: "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30",
        };
      default:
        return {
          icon: BarChart3,
          label: "Unknown",
          color: "text-muted-foreground",
          bg: "bg-muted",
          border: "border-border/50",
          gradient: "from-muted/20 to-muted/5",
          badge: "bg-muted/20 text-muted-foreground border-border/30",
        };
    }
  };

  const healthConfig = insight
    ? getHealthConfig(insight.healthStatus)
    : getHealthConfig("unknown");

  const HealthIcon = healthConfig.icon;

  // If analysis hasn't been triggered yet, show the CTA
  if (!hasRun && !error) {
    return (
      <Card className="border-border/50 shadow-sm bg-gradient-to-br from-indigo-500/5 to-purple-500/5 overflow-hidden relative group">
        {/* Decorative gradient blobs */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <CardContent className="p-6 sm:p-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0 shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]">
              <Brain className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold uppercase tracking-tight">
                AI-Powered Analysis
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Get intelligent insights, risk assessment, and actionable recommendations
                for your cash flow statement.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge
                  variant="secondary"
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Risk Detection
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  <Activity className="w-3 h-3 mr-1" />
                  Trend Analysis
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  <Lightbulb className="w-3 h-3 mr-1" />
                  Recommendations
                </Badge>
              </div>
            </div>
            <Button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              size="lg"
              className="h-12 px-6 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 shrink-0"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Analyze with AI
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isAnalyzing) {
    return (
      <Card className="border-border/50 shadow-sm bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
        <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            </div>
            <div className="absolute inset-0 rounded-full animate-ping bg-indigo-500/5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Analyzing Cash Flow Data
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Processing transactions and generating insights...
            </p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-indigo-500/40 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-rose-500/50 bg-rose-50 dark:bg-rose-950/20">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
              AI Analysis Failed
            </p>
            <p className="text-xs text-rose-500/80 mt-1">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onAnalyze}
            className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border-rose-500/30 text-rose-600 hover:bg-rose-500/10 shrink-0"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Results view
  if (!insight) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Health Status Header */}
      <Card
        className={cn(
          "border-border/50 shadow-sm bg-gradient-to-br overflow-hidden relative",
          healthConfig.gradient
        )}
      >
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div
              className={cn(
                "h-14 w-14 rounded-2xl border flex items-center justify-center shrink-0 shadow-[0_0_20px_-5px]",
                healthConfig.bg,
                healthConfig.border,
                healthConfig.color.replace("text-", "shadow-")
              )}
            >
              <HealthIcon className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl font-black uppercase tracking-tight">
                  AI Analysis Results
                </h3>
                <Badge className={cn("text-[10px] font-bold uppercase tracking-widest", healthConfig.badge)}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  {healthConfig.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {insight.summary}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest shrink-0"
            >
              <RefreshCw className={cn("w-3 h-3 mr-1", isAnalyzing && "animate-spin")} />
              Re-analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Key Findings */}
        <Card className="border-border/50 shadow-sm md:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wide">
                Key Findings
              </h4>
            </div>
            <ul className="space-y-2.5">
              {insight.keyFindings.map((finding, index) => (
                <li key={index} className="flex items-start gap-2.5 text-sm">
                  <span className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-muted-foreground">{finding}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Risks */}
        <Card
          className={cn(
            "border-border/50 shadow-sm",
            insight.risks.some((r) => r.includes("immediate") || r.includes("critical"))
              ? "border-rose-500/20"
              : ""
          )}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center",
                  insight.risks.some((r) => r.includes("immediate") || r.includes("critical"))
                    ? "bg-rose-500/10"
                    : "bg-amber-500/10"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    insight.risks.some((r) => r.includes("immediate") || r.includes("critical"))
                      ? "text-rose-500"
                      : "text-amber-500"
                  )}
                />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wide">Risks</h4>
            </div>
            <ul className="space-y-2.5">
              {insight.risks.map((risk, index) => (
                <li key={index} className="flex items-start gap-2.5 text-sm">
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      insight.risks.some((r) => r.includes("immediate") || r.includes("critical"))
                        ? "bg-rose-500/10"
                        : "bg-amber-500/10"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        insight.risks.some((r) => r.includes("immediate") || r.includes("critical"))
                          ? "bg-rose-500"
                          : "bg-amber-500"
                      )}
                    />
                  </span>
                  <span className="text-muted-foreground">{risk}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Trends */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <h4 className="text-sm font-bold uppercase tracking-wide">Trend Analysis</h4>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Operating
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {insight.trends.operating}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-center gap-2 mb-2">
                <PieChart className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  Investing
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {insight.trends.investing}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  Financing
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {insight.trends.financing}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-border/50 shadow-sm bg-gradient-to-br from-indigo-500/[0.02] to-purple-500/[0.02]">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-indigo-500" />
            </div>
            <h4 className="text-sm font-bold uppercase tracking-wide">
              Recommendations
            </h4>
          </div>
          <div className="space-y-2.5">
            {insight.recommendations.map((rec, index) => (
              <div
                key={index}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-background/50 border border-border/30 text-sm group hover:bg-background/80 transition-colors"
              >
                <div className="h-6 w-6 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-indigo-500/20 transition-colors">
                  <ArrowRight className="h-3 w-3 text-indigo-500" />
                </div>
                <span className="text-muted-foreground">{rec}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}