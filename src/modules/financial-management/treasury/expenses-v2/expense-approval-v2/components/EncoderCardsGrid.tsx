"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncoderGroupSummary, DivisionInfo } from "../types";
import { ArrowRight, Inbox, Building2, Receipt } from "lucide-react";

interface EncoderCardsGridProps {
  groups: EncoderGroupSummary[];
  divisions: DivisionInfo[];
  onSelectEncoder: (userId: number) => void;
}

export const EncoderCardsGrid: React.FC<EncoderCardsGridProps> = ({
  groups,
  divisions,
  onSelectEncoder,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const getDivisionName = (id?: number | null) => {
    if (!id) return "-";
    return divisions.find((d) => d.division_id === id)?.division_name || `Division #${id}`;
  };

  // Overall metrics
  const totalEncoders = groups.length;
  const totalPendingReceipts = groups.reduce((sum, g) => sum + g.pending_count, 0);
  const totalPendingValue = groups.reduce((sum, g) => sum + g.total_amount, 0);

  return (
    <div className="space-y-4">
      {/* Overall Metric Summary Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Users
          </span>
          <div className="text-lg font-mono font-bold text-foreground mt-1">
            {totalEncoders} <span className="text-xs font-sans font-normal text-muted-foreground">users with submissions</span>
          </div>
        </div>

        <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Pending Receipts
          </span>
          <div className="text-lg font-mono font-bold text-amber-500 mt-1">
            {totalPendingReceipts} <span className="text-xs font-sans font-normal text-muted-foreground">receipts awaiting action</span>
          </div>
        </div>

        <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Amount
          </span>
          <div className="text-lg font-mono font-bold text-emerald-500 mt-1">
            {formatCurrency(totalPendingValue)}
          </div>
        </div>
      </div>

      {/* Encoders Cards Grid */}
      {groups.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center border border-dashed border-border dark:border-zinc-700/80 rounded-xl bg-card dark:bg-zinc-900/60 text-muted-foreground text-xs space-y-2">
          <Inbox className="w-10 h-10 text-muted-foreground/40" />
          <span className="font-semibold text-foreground">No Pending Submissions</span>
          <span className="text-[11px] text-muted-foreground">
            There are currently no users with pending expense receipts awaiting your approval.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const fullName = `${group.user_fname} ${group.user_lname}`;
            const initials = `${group.user_fname[0] || ""}${group.user_lname[0] || ""}`.toUpperCase();

            return (
              <div
                key={group.user_id}
                onClick={() => onSelectEncoder(group.user_id)}
                className="bg-card border border-border dark:border-zinc-700/80 hover:border-primary/80 dark:hover:border-primary dark:bg-zinc-900/80 rounded-xl p-4 space-y-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                {/* Encoder Profile Header */}
                <div className="flex items-start justify-between gap-3 border-b border-border/80 dark:border-zinc-700/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors" title={fullName}>
                        {fullName}
                      </h4>
                    </div>
                  </div>

                  {/* Division Badge */}
                  {group.division_id ? (
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0 bg-muted/60 dark:bg-zinc-950 border border-border dark:border-zinc-700">
                      <Building2 className="w-3 h-3 mr-1 text-primary" />
                      {getDivisionName(group.division_id)}
                    </Badge>
                  ) : null}
                </div>

                {/* Submissions Insight Metrics */}
                <div className="grid grid-cols-2 gap-2 bg-muted/50 dark:bg-zinc-950/80 p-2.5 rounded-lg border border-border/70 dark:border-zinc-700/70 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-medium">Pending Receipts</span>
                    <span className="font-mono font-bold text-amber-500 flex items-center gap-1 mt-0.5">
                      <Receipt className="w-3.5 h-3.5" /> {group.pending_count} {group.pending_count === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block font-medium">Total Amount</span>
                    <span className="font-mono font-bold text-emerald-500 mt-0.5 block">
                      {formatCurrency(group.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Action CTA Button */}
                <div className="pt-2 flex items-center justify-between border-t border-border/80 dark:border-zinc-700/80 text-xs">
                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Click to review user submissions
                  </span>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-primary text-primary-foreground font-semibold px-2.5"
                  >
                    View Submissions <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
