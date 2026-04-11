"use client";

import * as React from "react";
import { 
  Activity, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalyticsSummary } from "../types";
import { cn } from "@/lib/utils";

interface RiskInsightsProps {
  data: AnalyticsSummary;
}

const ITEMS_PER_PAGE = 5;

export default function RiskInsights({ data }: RiskInsightsProps) {
  const [riskPage, setRiskPage] = React.useState(0);

  const statusEntries = Object.entries(data.statusBreakdown || {}).sort((a, b) => b[1] - a[1]);
  const highRisk = data.highRiskEntries || [];
  
  const totalRiskPages = Math.ceil(highRisk.length / ITEMS_PER_PAGE);
  const currentRiskItems = highRisk.slice(
    riskPage * ITEMS_PER_PAGE, 
    (riskPage + 1) * ITEMS_PER_PAGE
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* 1. Status Breakdown */}
      <Card className="border shadow-sm bg-background/50 backdrop-blur-sm overflow-hidden whitespace-nowrap">
        <CardHeader className="py-3 px-6 flex flex-row items-center gap-2 border-b bg-muted/20">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 px-6">
          <div className="flex flex-wrap items-center gap-3">
            {statusEntries.map(([status, count]) => (
              <div 
                key={status} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border shadow-sm"
              >
                <span className="text-xs font-medium text-muted-foreground">{status}:</span>
                <span className="text-xs font-semibold text-foreground">{count}</span>
              </div>
            ))}
            {statusEntries.length === 0 && (
              <span className="text-xs text-muted-foreground">No status data available</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. High-Risk Journal Entries */}
      <Card className="border border-rose-200/50 shadow-sm bg-rose-50/10 overflow-hidden">
        <CardHeader className="py-3 px-6 flex flex-row items-center justify-between border-b border-rose-100 bg-rose-50/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-rose-900">
              High-Risk Journal Entries
            </CardTitle>
            <Badge className="bg-rose-600 text-white border-none text-[10px] h-4 px-2 font-medium ml-1">
              Risk Audit ACTIVE
            </Badge>
          </div>
          
          {totalRiskPages > 1 && (
            <div className="flex items-center gap-1">
               <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-rose-700 hover:bg-rose-100/50"
                onClick={() => setRiskPage(p => Math.max(0, p - 1))}
                disabled={riskPage === 0}
               >
                 <ChevronLeft className="h-3 w-3" />
               </Button>
               <span className="text-[10px] font-semibold text-rose-800 px-1">
                 {riskPage + 1} / {totalRiskPages}
               </span>
               <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-rose-700 hover:bg-rose-100/50"
                onClick={() => setRiskPage(p => Math.min(totalRiskPages - 1, p + 1))}
                disabled={riskPage >= totalRiskPages - 1}
               >
                 <ChevronRight className="h-3 w-3" />
               </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-rose-100/30">
            {currentRiskItems.map((entry, idx) => (
              <div 
                key={entry.jeNo + idx} 
                className="flex items-center justify-between px-6 py-4 hover:bg-rose-50/30 transition-colors group"
              >
                <div className="flex flex-col items-start">
                  <span className="text-xs font-medium text-muted-foreground">
                    {entry.jeNo}
                  </span>
                </div>
                
                <div className="flex flex-wrap justify-end gap-1.5">
                  {entry.riskReasons.map((reason, rIdx) => (
                    <React.Fragment key={rIdx}>
                      <span className="text-xs font-semibold text-foreground">
                        {reason}
                      </span>
                      {rIdx < entry.riskReasons.length - 1 && (
                        <span className="text-muted-foreground/30 font-bold px-1">•</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
            
            {highRisk.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-emerald-50/5">
                 <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                    <Zap className="h-5 w-5 text-emerald-500" />
                 </div>
                 <p className="text-xs font-semibold text-emerald-700">Audit Clean</p>
                 <p className="text-xs mt-1 text-muted-foreground">No high-risk indicators detected in current filters.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Zap({ className, ...props }: any) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            <path d="M4 14.75V3.5a.5.5 0 0 1 .824-.372l14.5 12.676a.5.5 0 0 1-.33.846H9L5.158 22.047a.5.5 0 0 1-.849-.458L6 14.75z" />
        </svg>
    )
}
