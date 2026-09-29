"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseItem, ExpenseLog, LogAction } from "../types";
import { fetchExpenseLogs } from "../services/expenseService";
import { History, CheckCircle2, AlertTriangle, RefreshCw, XCircle, FileText } from "lucide-react";

interface HistoryLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ExpenseItem | null;
}

function formatLiteralDateTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  // Match "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD HH:mm:ss"
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
  }

  const [, yearStr, monthStr, dayStr, hourStr, minStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
  const monthName = months[month] || "";

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMin = String(minute).padStart(2, "0");

  return `${monthName} ${day}, ${year}, ${displayHour}:${displayMin} ${period}`;
}

export const HistoryLogModal: React.FC<HistoryLogModalProps> = ({
  open,
  onOpenChange,
  item,
}) => {
  const [logs, setLogs] = useState<ExpenseLog[]>([]);
  const [loading, setLoading] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setLoading(true);
      setLogs([]);
    }
  }

  useEffect(() => {
    let isMounted = true;
    if (item && open) {
      fetchExpenseLogs(item.id)
        .then((data) => {
          if (isMounted) setLogs(data);
        })
        .catch(() => {
          if (isMounted) setLogs([]);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [item, open]);

  const getActionBadge = (action: LogAction) => {
    switch (action) {
      case "Draft":
        return <Badge variant="secondary">Draft Created</Badge>;
      case "Pending Approval":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">Pending Approval</Badge>;
      case "Resubmitted":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">Resubmitted</Badge>;
      case "Approved To Disbursement":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Approved To Disbursement</Badge>;
      case "With Concern":
        return <Badge variant="destructive" className="bg-orange-500/10 text-orange-500 border-orange-500/30">With Concern</Badge>;
      case "Rejected":
        return <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border-rose-500/30">Rejected</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  const getActionIcon = (action: LogAction) => {
    switch (action) {
      case "Approved To Disbursement":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "With Concern":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "Resubmitted":
        return <RefreshCw className="w-4 h-4 text-amber-500" />;
      case "Rejected":
        return <XCircle className="w-4 h-4 text-rose-500" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const renderUserLabel = (createdBy: ExpenseLog["created_by"]) => {
    if (!createdBy) return null;
    if (typeof createdBy === "object") {
      const fname = createdBy.user_fname || "";
      const lname = createdBy.user_lname || "";
      const fullName = `${fname} ${lname}`.trim();
      if (fullName) return `User: ${fullName}`;
      return `User ID: #${createdBy.user_id}`;
    }
    return `User ID: #${createdBy}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <History className="w-5 h-5 text-primary" />
            Audit & Revision Lifecycle History
          </DialogTitle>
          {item ? (
            <p className="text-xs text-muted-foreground font-mono">
              Doc Code: <span className="text-primary font-bold">{item.doc_no}</span>
            </p>
          ) : null}
        </DialogHeader>

        <div className="py-2">
          {loading ? (
            <div className="relative border-l-2 border-border/60 ml-3 space-y-6 pl-4 my-2">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="relative space-y-2">
                  {/* Node Circle Skeleton */}
                  <div className="absolute -left-[23px] top-0.5">
                    <Skeleton className="w-5 h-5 rounded-full" />
                  </div>

                  {/* Header: Badge & Timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="w-32 h-5 rounded-md" />
                    <Skeleton className="w-24 h-3.5 rounded-md" />
                  </div>

                  {/* Remarks Box */}
                  <Skeleton className="w-full h-10 rounded-md" />

                  {/* User label */}
                  <Skeleton className="w-28 h-3 rounded-md" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-8">No history logs recorded.</p>
          ) : (
            <div className="relative border-l-2 border-border/60 ml-3 space-y-6 pl-4 my-2">
              {logs.map((log) => (
                <div key={log.id} className="relative group">
                  {/* Dot icon */}
                  <div className="absolute -left-[23px] top-0 p-1 bg-background border border-border/80 rounded-full">
                    {getActionIcon(log.action)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      {getActionBadge(log.action)}
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatLiteralDateTime(log.created_at)}
                      </span>
                    </div>

                    {log.remarks ? (
                      <p className="text-xs text-foreground bg-muted/30 p-2 rounded-md mt-1 border border-border/40 italic">
                        &quot;{log.remarks}&quot;
                      </p>
                    ) : null}

                    {log.created_by ? (
                      <p className="text-[10px] text-muted-foreground">{renderUserLabel(log.created_by)}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
