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
  FinalDecisionTarget,
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
  onOpenAuditeeDetails: (employeeId: number) => void;
  onToggleDecision: (
    status: FinalHeaderDecisionStatus,
    target: FinalDecisionTarget,
  ) => void;
  onSubmitStaged: () => void | Promise<void>;
};

type ActionButtonSetProps = {
  disabled: boolean;
  label: string;
  activeStatus: FinalHeaderDecisionStatus | null;
  onToggle: (status: FinalHeaderDecisionStatus) => void;
};

function getCell(cells: FinalTopSheetCellResponse[], employeeId: number) {
  return cells.find((cell) => cell.employee_id === employeeId) ?? null;
}

function buildEncoderTotals(data: FinalTopSheetResponse) {
  const totals = new Map<number, number>();

  for (const salesman of data.salesmen) {
    totals.set(salesman.employee_id, 0);
  }

  for (const coaRow of data.coa_rows) {
    for (const cell of coaRow.cells) {
      totals.set(
        cell.employee_id,
        (totals.get(cell.employee_id) ?? 0) + cell.amount,
      );
    }
  }

  return totals;
}

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
        className={`h-7 w-7 rounded-lg transition-all ${
          activeStatus === "Approved"
            ? "bg-emerald-600 text-white shadow-sm"
            : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
        }`}
        disabled={disabled}
        onClick={() => onToggle("Approved")}
        title={`Stage Approval for ${label}`}
      >
        <CheckCircle2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={`h-7 w-7 rounded-lg transition-all ${
          activeStatus === "With Concern"
            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
            : "border-amber-200 text-amber-600 hover:bg-amber-50"
        }`}
        disabled={disabled}
        onClick={() => onToggle("With Concern")}
        title={`Stage Concern for ${label}`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
      </Button>
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
  onToggleDecision,
  onSubmitStaged,
}: Props) {
  const encoderTotals = React.useMemo(() => buildEncoderTotals(data), [data]);
  const stagedCount = Object.keys(stagedDecisions).length;

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
            ) : null}
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
              {/* <TableHead className="sticky right-0 z-40 w-[100px] bg-slate-50 dark:bg-slate-950 px-3 py-2 border-b dark:border-slate-800 text-right text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 dark:text-white/40">
                Audit
              </TableHead> */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.salesmen.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={data.coa_rows.length + 3}
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
              data.salesmen.map((salesman) => {
                const rowTotal = encoderTotals.get(salesman.employee_id) ?? 0;
                const encoderLabel =
                  salesman.salesman_name || `Employee #${salesman.employee_id}`;

                return (
                  <TableRow
                    key={salesman.employee_id}
                    role="button"
                    tabIndex={0}
                    title={`Inspect expenses for ${encoderLabel}`}
                    className="group cursor-pointer transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none"
                    onClick={() => onOpenAuditeeDetails(salesman.employee_id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenAuditeeDetails(salesman.employee_id);
                      }
                    }}
                  >
                    <TableCell className="sticky left-0 z-20 bg-white dark:bg-slate-900 group-hover:bg-primary/5 group-focus-visible:bg-primary/5 backdrop-blur-sm px-3 py-1.5 border-r border-b dark:border-slate-800 shadow-[5px_0_15px_-10px_rgba(0,0,0,0.05)] dark:shadow-[5px_0_15px_-10px_rgba(0,0,0,0.5)] transition-all">
                      <div className="flex items-center gap-1.5 w-full rounded-lg px-1 py-0.5 group/auditee">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary text-white text-[8px] font-black group-hover/auditee:bg-blue-700 transition-colors">
                          {salesman.salesman_code?.slice(-2) || "??"}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p
                            className="truncate text-[10px] font-black text-slate-800 dark:text-slate-200 group-hover/auditee:text-primary transition-colors"
                            title={encoderLabel}
                          >
                            {encoderLabel}
                          </p>
                          <p className="text-[8px] text-primary/60 font-bold opacity-0 group-hover/auditee:opacity-100 transition-opacity leading-none">
                            Click row to inspect →
                          </p>
                        </div>
                        <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </TableCell>

                    {data.coa_rows.map((coaRow) => {
                      const cell = getCell(coaRow.cells, salesman.employee_id);
                      const target: FinalDecisionTarget = {
                        scope: "cell",
                        employee_id: salesman.employee_id,
                        coa_id: coaRow.coa_id,
                      };
                      const targetKey = `cell:${salesman.employee_id}:${coaRow.coa_id}`;
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
                                  className={`text-[10px] font-black tabular-nums ${cell.amount > 0 ? "text-slate-800 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}
                                >
                                  {formatCurrency(cell.amount)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-bold text-slate-400">
                                    {cell.count} line
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

                              <ActionButtonSet
                                disabled={submitting || !canAct}
                                label={`${encoderLabel} / ${coaRow.account_title}`}
                                activeStatus={activeStatus}
                                onToggle={(status) =>
                                  onToggleDecision(status, target)
                                }
                              />
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
                      <p className="text-[10px] font-black text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatCurrency(rowTotal)}
                      </p>
                    </TableCell>

                    {/* <TableCell
                      className={`sticky right-0 z-20 backdrop-blur-sm px-3 py-1.5 border-b dark:border-slate-800 transition-all ${
                        stagedDecisions[`encoder:${salesman.employee_id}`] ===
                        "Approved"
                          ? "bg-emerald-50 dark:bg-emerald-900/20"
                          : stagedDecisions[
                                `encoder:${salesman.employee_id}`
                              ] === "With Concern"
                            ? "bg-amber-50 dark:bg-amber-900/20"
                            : stagedDecisions[
                                  `encoder:${salesman.employee_id}`
                                ] === "Rejected"
                              ? "bg-rose-50 dark:bg-rose-900/20"
                              : "bg-white dark:bg-slate-900 group-hover:bg-primary/5"
                      }`}
                    >
                      <ActionButtonSet
                        disabled={submitting || !canAct || rowTotal <= 0}
                        label={encoderLabel}
                        activeStatus={
                          stagedDecisions[`encoder:${salesman.employee_id}`] ??
                          null
                        }
                        onToggle={(status) =>
                          onToggleDecision(status, {
                            scope: "encoder",
                            employee_id: salesman.employee_id,
                          })
                        }
                      />
                    </TableCell> */}
                  </TableRow>
                );
              })
            )}

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
                  {isApprovedHistory
                    ? "Finalized"
                    : canAct
                      ? "Ready"
                      : "Waiting"}
                </span>
              </TableCell> */}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
