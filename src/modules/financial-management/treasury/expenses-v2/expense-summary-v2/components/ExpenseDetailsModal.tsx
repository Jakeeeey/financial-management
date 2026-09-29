"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ExpenseSummaryItem,
  ExpenseLogEntry,
  SupplierOption,
  ChartOfAccountOption,
  DivisionInfo,
  DepartmentOption,
} from "../types";
import {
  FileText,
  Receipt,
  User,
  ExternalLink,
  History,
  ShieldCheck,
} from "lucide-react";

interface ExpenseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ExpenseSummaryItem | null;
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionInfo[];
  departments: DepartmentOption[];
}

export const ExpenseDetailsModal: React.FC<ExpenseDetailsModalProps> = ({
  isOpen,
  onClose,
  item,
  suppliers,
  coas,
  divisions,
  departments,
}) => {
  const [logs, setLogs] = useState<ExpenseLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (!item?.id || !isOpen) {
      setLogs([]);
      return;
    }

    const fetchLogs = async () => {
      try {
        setLoadingLogs(true);
        const res = await fetch(
          `/api/fm/treasury/expenses-v2/expense-summary-v2/logs?expense_id=${item.id}`
        );
        if (res.ok) {
          const json = await res.json();
          setLogs(json.data || []);
        }
      } catch (e) {
        console.error("Error fetching expense logs timeline:", e);
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [item?.id, isOpen]);

  if (!item) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const getSupplierName = (id: number) => {
    return suppliers.find((s) => s.id === id)?.supplier_name || `Supplier #${id}`;
  };

  const getCoaName = (id: number) => {
    const found = coas.find((c) => c.coa_id === id);
    return found ? `${found.gl_code || ""} - ${found.account_title || ""}` : `COA #${id}`;
  };

  const getDivisionName = (id?: number | null) => {
    if (!id) return "-";
    return divisions.find((d) => d.division_id === id)?.division_name || `Division #${id}`;
  };

  const getDepartmentName = (id?: number | null) => {
    if (!id) return "-";
    return departments.find((d) => d.department_id === id)?.department_name || `Department #${id}`;
  };

  const getLogUserFname = (log: ExpenseLogEntry) => {
    const u = typeof log.created_by === "object" && log.created_by !== null ? log.created_by : null;
    if (u) return `${u.user_fname} ${u.user_lname}`;
    return `User #${log.created_by || "-"}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-mono text-foreground flex items-center gap-2">
                  {item.doc_no}
                  <Badge variant="outline" className="text-[10px] font-sans font-semibold">
                    {item.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Detailed breakdown, receipt snapshot, and complete approval timeline audit logs.
                </DialogDescription>
              </div>
            </div>
            <div className="font-mono text-base font-bold text-emerald-500">
              {formatCurrency(Number(item.amount))}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-muted/40 p-3.5 rounded-xl border border-border/70">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Payee / Supplier
              </span>
              <span className="font-bold text-foreground block mt-0.5">
                {getSupplierName(item.payee)}
                {item.is_employee ? (
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">(Employee)</span>
                ) : null}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Chart of Accounts (COA)
              </span>
              <span className="font-bold text-foreground block mt-0.5">
                {getCoaName(item.coa_id)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Expense Date
              </span>
              <span className="font-medium text-foreground block mt-0.5">
                {item.expense_date}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Division / Department
              </span>
              <span className="font-medium text-foreground block mt-0.5">
                {getDivisionName(item.division_id)} / {getDepartmentName(item.department_id)}
              </span>
            </div>

            {item.remarks && (
              <div className="md:col-span-2 pt-2 border-t border-border/60">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Remarks / Purpose
                </span>
                <span className="text-foreground block mt-0.5 whitespace-pre-wrap">
                  {item.remarks}
                </span>
              </div>
            )}
          </div>

          {/* Disbursement Handoff Box if Final Approved */}
          {(item.disbursement_id || item.disbursement_payable_id || item.is_final_approved) && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs space-y-1">
              <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Final Approved Handoff
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-4 flex-wrap">
                <span>Disbursement ID: <strong className="font-mono text-foreground">{item.disbursement_id || "-"}</strong></span>
                <span>Payable ID: <strong className="font-mono text-foreground">{item.disbursement_payable_id || "-"}</strong></span>
              </div>
            </div>
          )}

          {/* Receipt Image Preview */}
          {item.receipt_url && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-primary" /> Receipt Attachment
                </h4>
                <a
                  href={item.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  Open Original <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="border border-border/80 rounded-xl overflow-hidden bg-zinc-950/40 p-2 max-h-56 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.receipt_url}
                  alt="Receipt Preview"
                  className="max-h-52 object-contain rounded-lg"
                />
              </div>
            </div>
          )}

          <Separator className="my-2" />

          {/* Timeline Audit Logs */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <History className="w-4 h-4 text-primary" /> Approval Timeline & Audit Trail
            </h4>

            {loadingLogs ? (
              <div className="py-6 text-center text-xs text-muted-foreground italic">
                Loading audit trail logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg">
                No log records found for this expense.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3 rounded-xl border border-border/80 bg-muted/30 text-xs flex flex-col space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono font-bold">
                          {log.action}
                        </Badge>
                        <span className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
                          <User className="w-3 h-3 text-muted-foreground" /> {getLogUserFname(log)}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {log.created_at ? new Date(log.created_at).toLocaleString("en-PH") : "-"}
                      </span>
                    </div>

                    {log.remarks && (
                      <p className="text-muted-foreground text-[11px] italic bg-background/60 p-2 rounded-lg border border-border/50">
                        &quot;{log.remarks}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
