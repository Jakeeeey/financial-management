"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrialBalanceItem } from "../types/trial-balance.schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export function TrialBalanceSummaryView({
  data,
  onAccountClick,
}: {
  data: TrialBalanceItem[];
  onAccountClick: (account: TrialBalanceItem) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((account) => {
        const flagLower = account.reviewFlag.toLowerCase();
        return (
          <Card
            key={account.glCode}
            className="group hover:shadow-md transition-all cursor-pointer border-muted-foreground/10"
            onClick={() => onAccountClick(account)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <span className="text-muted-foreground mr-2 font-mono">{account.glCode}</span>
                {account.accountTitle}
              </CardTitle>
              <Badge
                variant={
                  flagLower === "critical" ? "destructive" :
                  flagLower === "high" ? "outline" : "secondary"
                }
                className={cn(
                  "capitalize text-[10px] h-5",
                  flagLower === "high" && "border-orange-500 text-orange-500 bg-orange-50"
                )}
              >
                {account.reviewFlag}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className={cn(
                    "text-2xl font-bold",
                    account.netBalance < 0 && "text-destructive"
                  )}>
                    {formatCurrency(account.netBalance)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                    {account.balanceType} balance • Click to review journal entry lines
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
