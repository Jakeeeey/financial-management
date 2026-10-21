"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { TrialBalanceItem } from "../types/trial-balance.schema";
import { formatTrialBalanceAmount, getPeriodMovementLabel } from "../utils/money";
import { getTrialBalanceReviewLabel, getTrialBalanceReviewReason } from "../utils/review-flags";

export function TrialBalanceSummaryView({
  data,
  onAccountClick,
}: {
  data: TrialBalanceItem[];
  onAccountClick: (account: TrialBalanceItem, trigger: HTMLButtonElement) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.map(account => {
        const needsReview = account.reviewFlag.toLowerCase() === "critical";
        const reviewReason = getTrialBalanceReviewReason(account.reviewFlag, account.reviewReason);
        return (
          <Card key={account.glCode} className="border-muted-foreground/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <span className="mr-2 font-mono text-muted-foreground">{account.glCode}</span>
                {account.accountTitle}
              </CardTitle>
              <Badge
                variant={needsReview ? "outline" : "secondary"}
                className={cn("h-5 text-[10px]", needsReview && "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200")}
              >
                {getTrialBalanceReviewLabel(account.reviewFlag)}
              </Badge>
            </CardHeader>
            <CardContent>
              {reviewReason && <p className="mb-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">{reviewReason}</p>}
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1 space-y-1 text-right">
                  <p className="text-xs text-muted-foreground">Net period movement</p>
                  <p className="break-words text-2xl font-bold tabular-nums">
                    {formatTrialBalanceAmount(account.netBalance)}
                  </p>
                  <p className="text-[10px] uppercase tracking-tight text-muted-foreground">
                    {getPeriodMovementLabel(account)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                onClick={event => onAccountClick(account, event.currentTarget)}
                aria-label={`View entries for ${account.glCode} ${account.accountTitle}`}
              >
                View entries
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
