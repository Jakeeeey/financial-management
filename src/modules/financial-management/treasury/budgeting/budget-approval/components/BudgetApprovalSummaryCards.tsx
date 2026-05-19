"use client";

import React from "react";
import { useBudgetApprovalContext } from "../providers/BudgetApprovalProvider";
import { formatCurrency as fmt } from "../utils";
import { Send, RefreshCw, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function StatsCard({ label, value, icon, color, compactLayout }: { label: string; value: number; icon: React.ReactNode; color: string; compactLayout?: boolean }) {
    const colorClasses: Record<string, string> = {
        slate: "bg-slate-500/10 text-slate-700 border-slate-500/20",
        amber: "bg-amber-500/10 text-amber-700 border-amber-500/20",
        emerald: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    };

    return (
        <Card className={`rounded-2xl border ${colorClasses[color] || ""} shadow-none w-full`}>
            <CardContent className={`${compactLayout ? "p-2.5 gap-2" : "p-3 gap-3"} flex items-center`}>
                <div className={`${compactLayout ? "p-1.5" : "p-2"} rounded-xl bg-background/50 border border-current/10 shrink-0`}>
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`${compactLayout ? "text-[8px]" : "text-[9px]"} uppercase tracking-wider font-bold opacity-70 truncate leading-none mb-1`}>{label}</p>
                    <p className={`${compactLayout ? "text-xs md:text-sm font-bold" : "text-base md:text-lg font-black"} tracking-tighter truncate leading-none`}>
                        {fmt(value)}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export function BudgetApprovalSummaryCards() {
  const { displayedItems } = useBudgetApprovalContext();

  // Compute actual entry-type breakdowns based on currently loaded view subset
  let originalAmount = 0;
  let supplementalAmount = 0;
  let totalAmount = 0;

  displayedItems.forEach((b) => {
    const amt = Number(b.amount || 0);
    totalAmount += amt;
    if (b.entry_type === "original") {
        originalAmount += amt;
    } else {
        // Combines both supplemental and realignment requests
        supplementalAmount += amt;
    }
  });

  const hasSupplemental = supplementalAmount > 0;

  if (hasSupplemental) {
      return (
          <div className="flex flex-col gap-3 w-full animate-in fade-in duration-300">
              {/* Row 1: Full-Width Grand Total Container */}
              <StatsCard 
                  label="Grand Total" 
                  value={totalAmount}
                  icon={<Coins className="h-4 w-4 text-emerald-500" />}
                  color="emerald"
              />
              {/* Row 2: Two-Column Side-by-Side Split */}
              <div className="grid grid-cols-2 gap-2.5 w-full">
                  <StatsCard 
                      label="Original" 
                      value={originalAmount}
                      icon={<RefreshCw className="h-3.5 w-3.5 text-slate-500" />}
                      color="slate"
                      compactLayout
                  />
                  <StatsCard 
                      label="Supplemental" 
                      value={supplementalAmount}
                      icon={<Send className="h-3.5 w-3.5 text-amber-500" />}
                      color="amber"
                      compactLayout
                  />
              </div>
          </div>
      );
  }

  // Fallback Condition when no supplemental budgets are proposed: vertically stack them to balance the Left Column Container
  return (
      <div className="flex flex-col gap-3 w-full animate-in fade-in duration-300">
          <StatsCard 
              label="Grand Total" 
              value={totalAmount}
              icon={<Coins className="h-4 w-4 text-emerald-500" />}
              color="emerald"
          />
          <StatsCard 
              label="Original" 
              value={originalAmount}
              icon={<RefreshCw className="h-4 w-4 text-slate-500" />}
              color="slate"
          />
      </div>
  );
}
