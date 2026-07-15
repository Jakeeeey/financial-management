// src/modules/financial-management/treasury/bulk-approval/components/FinalTopSheetMatrix.tsx
"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  MousePointerClick,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  FinalHeaderDecisionStatus,
  FinalTopSheetCellResponse,
  FinalTopSheetResponse,
} from "../type";
import { formatCurrency } from "../utils/format";

type Props = {
  data: FinalTopSheetResponse;
  submitting: boolean;
  canAct: boolean;
  readOnlyReason?: string;
  stagedDecisions: Record<string, FinalHeaderDecisionStatus>;
  onOpenAuditeeDetails: (employeeId: number, headerId?: number) => void;
  onSubmitStaged: () => void | Promise<void>;
};

type ActionButtonSetProps = {
  disabled: boolean;
  label: string;
  activeStatus: FinalHeaderDecisionStatus | null;
  onToggle: (status: FinalHeaderDecisionStatus) => void;
};

function getCell(cells: FinalTopSheetCellResponse[], employeeId: number, headerId?: number) {
  return cells.find((cell) => {
    if (cell.employee_id !== employeeId) return false;
    if (headerId !== undefined && cell.header_id !== undefined && cell.header_id !== headerId) return false;
    return true;
  }) ?? null;
}

function buildEncoderTotals(data: FinalTopSheetResponse) {
  const totals = new Map<string, number>();

  for (const salesman of data.salesmen) {
    totals.set(`${salesman.employee_id}-${salesman.header_id ?? 0}`, 0);
  }

  for (const coaRow of data.coa_rows) {
    for (const cell of coaRow.cells) {
      const key = `${cell.employee_id}-${cell.header_id ?? 0}`;
      totals.set(
        key,
        (totals.get(key) ?? 0) + cell.amount,
      );
    }
  }

  return totals;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ActionButtonSet({
  disabled,
  label,
  activeStatus,
  onToggle,
}: ActionButtonSetProps) {
  return (
    <div
      className="flex items-center justify-end gap-1"
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={`h-7 w-7 rounded-lg transition-all ${
          activeStatus === "Rejected"
            ? "bg-rose-500 text-white border-rose-500 shadow-sm"
            : "border-rose-200 text-rose-600 hover:bg-rose-50"
        }`}
        disabled={disabled}
        onClick={() => onToggle("Rejected")}
        title={`Stage Rejection for ${label}`}
      >
        <XCircle className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function FinalTopSheetMatrix({
  data,
  submitting,
  canAct,
  readOnlyReason,
  stagedDecisions,
  onOpenAuditeeDetails,
  onSubmitStaged,
}: Props) {
  const encoderTotals = React.useMemo(() => buildEncoderTotals(data), [data]);
  const stagedCount = Object.keys(stagedDecisions).length;

  const [activeTab, setActiveTab] = React.useState<"pending" | "archived">("pending");

  const { pendingSalesmen, archivedSalesmen } = React.useMemo(() => {
    const pending: typeof data.salesmen = [];
    const archived: typeof data.salesmen = [];

    for (const salesman of data.salesmen) {
      const salesmanDetails = data.details.filter(
        d => d.employee_id === salesman.employee_id && d.header_id === salesman.header_id
      );
      const isFullyRejected = salesmanDetails.length > 0 && salesmanDetails.every(d => d.status.toLowerCase() === "rejected");
      const isFullyApproved = salesman.draft_statuses && salesman.draft_statuses.length > 0 && salesman.draft_statuses.every(s => s.toLowerCase() === "approved");

      if (isFullyRejected || isFullyApproved) {
        archived.push(salesman);
      } else {
        pending.push(salesman);
      }
    }

    return { pendingSalesmen: pending, archivedSalesmen: archived };
  }, [data]);

  const visibleSalesmen = activeTab === "pending" ? pendingSalesmen : archivedSalesmen;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl">
      <div className="shrink-0 border-b dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">
                Audit Matrix: Encoder × COA
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Click any auditee row to inspect line details. Use audit buttons
                to stage decisions.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 ml-2">
              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeTab === "pending"
                    ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <span>Pending Review</span>
                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[8px] font-bold ${activeTab === 'pending' ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  {pendingSalesmen.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("archived")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeTab === "archived"
                    ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <span>Archive / Decided</span>
                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[8px] font-bold ${activeTab === 'archived' ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  {archivedSalesmen.length}
                </span>
              </button>
            </div>

            {stagedCount > 0 && (
              <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                <Button
                  size="sm"
                  className="h-8 rounded-xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-900/20 hover:bg-primary transition-all active:scale-95"
                  onClick={onSubmitStaged}
                  disabled={submitting}
                >
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                  Submit {stagedCount} Staged Decision
                  {stagedCount !== 1 ? "s" : ""}
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!canAct ? (
              <div
                className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-amber-800 dark:text-amber-400"
                title={readOnlyReason}
              >
                <LockKeyhole className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest text-nowrap">
                  View Only
                </span>
              </div>
            ) : (
              null /* <div className="flex items-center gap-3 pr-3 mr-1 border-r border-slate-200 dark:border-slate-800">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Global Actions:</span>
                <ActionButtonSet
                  disabled={submitting}
                  label="Entire Top Sheet"
                  activeStatus={stagedDecisions["all"] ?? null}
                  onToggle={(status) => onToggleDecision(status, { scope: "all" })}
                />
              </div> */
            )}
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-800/60 dark:text-emerald-400/60">
                Total
              </span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                {formatCurrency(data.grand_total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
        <Table className="border-separate border-spacing-0">
          <TableHeader className="sticky top-0 z-30 shadow-[0_5px_15px_-10px_rgba(0,0,0,0.1)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-40 w-[130px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2 border-b border-r dark:border-slate-800 text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                Auditee
              </TableHead>
              {data.coa_rows.map((coaRow) => (
                <TableHead
                  key={coaRow.coa_id}
                  className="min-w-[75px] bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md px-1.5 py-1.5 border-b border-r dark:border-slate-800 last:border-r-0 text-right"
                >
                  <div className="flex flex-col items-end">
                    <span
                      className="block max-w-[70px] truncate text-[7px] font-black uppercase tracking-tight text-slate-500"
                      title={coaRow.account_title}
                    >
                      {coaRow.account_title}
                    </span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-40 w-[80px] bg-slate-50 dark:bg-slate-950 px-2 py-2 border-b dark:border-slate-800 text-right text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 dark:text-white/40">
                Total
              </TableHead>
              <TableHead className="sticky right-0 z-40 w-[100px] bg-slate-50 dark:bg-slate-950 px-3 py-2 border-b dark:border-slate-800 text-right text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 dark:text-white/40">
                Audit
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleSalesmen.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={data.coa_rows.length + 2}
                  className="h-[400px] text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-4 opacity-20">
                    <AlertTriangle size={64} />
                    <p className="text-xl font-black uppercase tracking-widest">
                      No Records Found
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibleSalesmen.map((salesman) => {
                const rowTotal = encoderTotals.get(`${salesman.employee_id}-${salesman.header_id ?? 0}`) ?? 0;
                const encoderLabel = salesman.header_id
                  ? `${salesman.salesman_name || `Employee #${salesman.employee_id}`} (Header #${salesman.header_id})`
                  : salesman.salesman_name || `Employee #${salesman.employee_id}`;
                
                const salesmanDetails = data.details.filter(
                  d => d.employee_id === salesman.employee_id && d.header_id === salesman.header_id
                );
                const isFullyRejected = salesmanDetails.length > 0 && salesmanDetails.every(d => d.status.toLowerCase() === "rejected");
                const isFullyApproved = salesman.draft_statuses && salesman.draft_statuses.length > 0 && salesman.draft_statuses.every(s => s.toLowerCase() === "approved");

                return (
                  <TableRow
                    key={`${salesman.employee_id}-${salesman.header_id ?? 0}`}
                    role="button"
                    tabIndex={0}
                    title={`Inspect expenses for ${encoderLabel}`}
                    className={`group cursor-pointer transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none ${isFullyRejected ? "opacity-30 grayscale" : ""} ${isFullyApproved ? "bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]" : ""}`}
                    onClick={() => onOpenAuditeeDetails(salesman.employee_id, salesman.header_id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenAuditeeDetails(salesman.employee_id, salesman.header_id);
                      }
                    }}
                  >
                    <TableCell className="sticky left-0 z-20 bg-white dark:bg-slate-900 group-hover:bg-primary/5 group-focus-visible:bg-primary/5 backdrop-blur-sm px-3 py-1.5 border-r border-b dark:border-slate-800 shadow-[5px_0_15px_-10px_rgba(0,0,0,0.05)] dark:shadow-[5px_0_15px_-10px_rgba(0,0,0,0.05)] transition-all">
                      <div className="flex items-center gap-1.5 w-full rounded-lg px-1 py-0.5 group/auditee">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary text-white text-[8px] font-black group-hover/auditee:bg-blue-700 transition-colors">
                          {salesman.salesman_code?.slice(-2) || "??"}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <p
                              className="truncate text-[10px] font-black text-slate-800 dark:text-slate-200 group-hover/auditee:text-primary transition-colors"
                              title={encoderLabel}
                            >
                              {encoderLabel}
                            </p>
                            {isFullyApproved && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 text-[8px] h-3.5 px-1 py-0 font-bold shrink-0">
                                Approved
                              </Badge>
                            )}
                          </div>
                          <p className="text-[8px] text-primary/60 font-bold opacity-0 group-hover/auditee:opacity-100 transition-opacity leading-none">
                            Click row to inspect →
                          </p>
                        </div>
                        <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </TableCell>
 
                    {data.coa_rows.map((coaRow) => {
                      const cell = getCell(coaRow.cells, salesman.employee_id, salesman.header_id);
                      const targetKey = salesman.header_id
                        ? `cell:${salesman.employee_id}:${coaRow.coa_id}:${salesman.header_id}`
                        : `cell:${salesman.employee_id}:${coaRow.coa_id}`;
                      const activeStatus = stagedDecisions[targetKey] ?? null;
 
                      return (
                        <TableCell
                          key={coaRow.coa_id}
                          className={`p-0 border-r border-b dark:border-slate-800 last:border-r-0 align-top group/cell transition-colors ${
                            activeStatus === "Approved"
                              ? "bg-emerald-50/50 dark:bg-emerald-900/20"
                              : activeStatus === "With Concern"
                                ? "bg-amber-50/50 dark:bg-amber-900/20"
                                : activeStatus === "Rejected"
                                  ? "bg-rose-50/50 dark:bg-rose-900/20"
                                  : ""
                          }`}
                        >
                          {cell ? (
                            <div className="flex h-full min-h-[70px] w-full flex-col items-end justify-between gap-2 px-2 py-2">
                              <div className="flex w-full flex-col items-end justify-start">
                                <span
                                  className={`text-xs font-black tabular-nums ${cell.amount > 0 ? "text-slate-800 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}
                                >
                                  {formatCurrency(cell.amount)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {cell.count} line item
                                    {cell.count !== 1 ? "s" : ""}
                                  </span>
                                  {cell.has_concern && (
                                    <span title="Contains flagged items">
                                      <AlertTriangle className="h-2.5 w-2.5 text-amber-500 fill-amber-50" />
                                    </span>
                                  )}
                                  {cell.has_rejected && (
                                    <span title="Contains rejected items">
                                      <XCircle className="h-2.5 w-2.5 text-rose-500 fill-rose-50" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full w-full px-2 py-2 text-right">
                              <span className="text-[8px] font-black text-slate-100">
                                —
                              </span>
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
 
                    <TableCell className="sticky right-0 z-20 bg-slate-50 dark:bg-slate-950 group-hover:bg-primary/5 backdrop-blur-sm px-2 py-1.5 text-right border-b dark:border-slate-800 transition-all">
                      <p className="text-xs font-black text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatCurrency(rowTotal)}
                      </p>
                    </TableCell>
 
                    {/* <TableCell
                      className={`sticky right-0 z-20 backdrop-blur-sm px-3 py-1.5 border-b dark:border-slate-800 transition-all ${
                        stagedDecisions[
                          salesman.header_id
                            ? `encoder:${salesman.employee_id}:${salesman.header_id}`
                            : `encoder:${salesman.employee_id}`
                        ] === "Approved"
                          ? "bg-emerald-50 dark:bg-emerald-900/20"
                          : stagedDecisions[
                              salesman.header_id
                                ? `encoder:${salesman.employee_id}:${salesman.header_id}`
                                : `encoder:${salesman.employee_id}`
                            ] === "With Concern"
                            ? "bg-amber-50 dark:bg-amber-900/20"
                            : stagedDecisions[
                                salesman.header_id
                                  ? `encoder:${salesman.employee_id}:${salesman.header_id}`
                                  : `encoder:${salesman.employee_id}`
                              ] === "Rejected"
                              ? "bg-rose-50 dark:bg-rose-900/20"
                              : "bg-white dark:bg-slate-900 group-hover:bg-primary/5"
                      }`}
                    >
                      <ActionButtonSet
                        disabled={submitting || !canAct || rowTotal <= 0}
                        label={encoderLabel}
                        activeStatus={
                          stagedDecisions[
                            salesman.header_id
                              ? `encoder:${salesman.employee_id}:${salesman.header_id}`
                              : `encoder:${salesman.employee_id}`
                          ] ?? null
                        }
                        onToggle={(status) =>
                          onToggleDecision(status, {
                            scope: "encoder",
                            employee_id: salesman.employee_id,
                            header_id: salesman.header_id,
                          })
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}

            {activeTab !== "archived" && (
              <TableRow className="sticky bottom-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
                <TableCell className="sticky left-0 z-40 bg-slate-100 dark:bg-black px-4 py-2 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">
                  Metrics
                </TableCell>
                {data.coa_rows.map((coaRow) => (
                  <TableCell
                    key={coaRow.coa_id}
                    className="bg-slate-50/95 dark:bg-black/95 px-2 py-2 text-right border-r border-slate-200 dark:border-white/5 last:border-r-0"
                  >
                    <p className="text-[11px] font-black text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(coaRow.row_total)}
                    </p>
                  </TableCell>
                ))}
                <TableCell className="sticky right-0 z-40 bg-emerald-600 px-3 py-2 text-right">
                  <p className="text-xs font-black text-white tabular-nums leading-none">
                    {formatCurrency(data.grand_total)}
                  </p>
                </TableCell>
                {/* <TableCell className="sticky right-0 z-40 bg-emerald-600 px-4 py-2 text-right">
                  <span className="text-[9px] font-black uppercase text-white/60">
                    {canAct ? "Ready" : "Waiting"}
                  </span>
                </TableCell> */}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
