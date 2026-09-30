"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncoderSummaryGroup, DivisionInfo } from "../types";
import { ArrowRight, Inbox, Building2, Receipt } from "lucide-react";

interface SummaryEncoderCardsGridProps {
  groups: EncoderSummaryGroup[];
  divisions: DivisionInfo[];
  onSelectEncoder: (userId: number) => void;
}

export const SummaryEncoderCardsGrid: React.FC<SummaryEncoderCardsGridProps> = ({
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

  return (
    <div className="space-y-4">
      {/* Encoders Cards Grid */}
      {groups.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center border border-dashed border-border dark:border-zinc-700/80 rounded-xl bg-card dark:bg-zinc-900/60 text-muted-foreground text-xs space-y-2">
          <Inbox className="w-10 h-10 text-muted-foreground/40" />
          <span className="font-semibold text-foreground">No Submissions Found</span>
          <span className="text-[11px] text-muted-foreground">
            There are currently no expense records matching your active filters.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const fullName = `${group.user_fname} ${group.user_lname}`;
            const initials = `${group.user_fname[0] || ""}${group.user_lname[0] || ""}`.toUpperCase();
            const hasConcernItem = group.items.some((i) => i.has_concern || i.status === "With Concern");

            return (
              <div
                key={group.user_id}
                onClick={() => onSelectEncoder(group.user_id)}
                className={`bg-card border dark:bg-zinc-900/80 rounded-xl p-4 space-y-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between ${
                  hasConcernItem
                    ? "border-amber-500/50 hover:border-amber-500 dark:border-amber-500/40"
                    : "border-border dark:border-zinc-700/80 hover:border-primary/80 dark:hover:border-primary"
                }`}
              >
                {/* Encoder Profile Header */}
                <div className="flex items-start justify-between gap-3 border-b border-border/80 dark:border-zinc-700/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1.5" title={fullName}>
                        {fullName}
                        {hasConcernItem && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Has items with concern" />
                        )}
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
                <div className="bg-muted/50 dark:bg-zinc-950/80 p-2.5 rounded-lg border border-border/70 dark:border-zinc-700/70 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">Expense Receipts</span>
                      <span className="font-mono font-bold text-foreground flex items-center gap-1 mt-0.5">
                        <Receipt className="w-3.5 h-3.5 text-primary" /> {group.total_count} {group.total_count === 1 ? "item" : "items"}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block font-medium">Total Amount</span>
                      <span className="font-mono font-bold text-emerald-500 mt-0.5 block">
                        {formatCurrency(group.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action CTA Button */}
                <div className="pt-2 flex items-center justify-between border-t border-border/80 dark:border-zinc-700/80 text-xs">
                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Click to view details & timeline
                  </span>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-primary text-primary-foreground font-semibold px-2.5"
                  >
                    View Details <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
