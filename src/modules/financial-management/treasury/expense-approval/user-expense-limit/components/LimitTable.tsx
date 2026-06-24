// src/modules/financial-management/treasury/expense-approval/user-expense-limit/components/LimitTable.tsx

"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, ChevronDown, ChevronUp, Utensils, Car, Fuel as FuelIcon, Bus, HelpCircle, Tag, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from "@/components/ui/pagination";
import type { UserExpenseLimit } from "../types";
import { formatPeso, BUDGET_COAS } from "../utils";
import { useCoas } from "../hooks/useUserExpenseLimit";

const PAGE_SIZE = 10;

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export function getCoaConfig(coaId: number, name: string = "", glCode: string = "") {
  switch (coaId) {
    case 120:
      return {
        name: "Meals",
        glCode: "1024",
        icon: Utensils,
        colorClass: "text-orange-500 bg-orange-500/10 border-orange-500/20",
        accentColor: "from-orange-500 to-amber-500"
      };
    case 124:
      return {
        name: "Parking Fee / Tool Fee",
        glCode: "1027",
        icon: Car,
        colorClass: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        accentColor: "from-blue-500 to-indigo-500"
      };
    case 161:
      return {
        name: "Fuel",
        glCode: "1031",
        icon: FuelIcon,
        colorClass: "text-sky-500 bg-sky-500/10 border-sky-500/20",
        accentColor: "from-sky-500 to-blue-500"
      };
    case 139:
      return {
        name: "Transportation",
        glCode: "1000",
        icon: Bus,
        colorClass: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        accentColor: "from-purple-500 to-pink-500"
      };
    case 69:
      return {
        name: "Others (Supplies/Repairs/etc)",
        glCode: "1017",
        icon: HelpCircle,
        colorClass: "text-slate-500 bg-slate-500/10 border-slate-500/20",
        accentColor: "from-slate-500 to-zinc-500"
      };
    default:
      return {
        name: name || `Account #${coaId}`,
        glCode: glCode || "—",
        icon: Tag,
        colorClass: "text-violet-500 bg-violet-500/10 border-violet-500/20",
        accentColor: "from-violet-500 to-purple-500"
      };
  }
}

interface LimitTableProps {
  limits:  UserExpenseLimit[];
  loading: boolean;
  error:   string | null;
  onEdit:  (limit: UserExpenseLimit) => void;
}

export function LimitTable({ limits, loading, error, onEdit }: LimitTableProps) {
  const [page,   setPage]   = useState(1);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const { coas } = useCoas();

  const filtered = limits;
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage    = Math.min(page, totalPages || 1);
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  // Sum active or pending limits
  const sumLimits = (limObj: Record<number, string> | null): number => {
    if (!limObj) return 0;
    return Object.values(limObj).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };

  const toggleRow = (userId: number) => {
    setExpandedUserId(prev => (prev === userId ? null : userId));
  };

  // Find all active & pending limits for visual breakdown
  const getAllCeilings = (l: UserExpenseLimit) => {
    const allCoaIds = new Set([
      ...Object.keys(l.limits || {}).map(Number),
      ...Object.keys(l.pending_limits || {}).map(Number)
    ]);

    // Ensure defaults show up even if empty
    BUDGET_COAS.forEach(c => allCoaIds.add(c.id));

    return Array.from(allCoaIds).map(id => {
      const coaDetail = coas.find(c => c.coa_id === id);
      const config = getCoaConfig(id, coaDetail?.account_title, coaDetail?.gl_code);
      const activeVal = l.limits?.[id];
      const pendingVal = l.pending_limits?.[id];
      const defaultIds = new Set(BUDGET_COAS.map(c => c.id));

      return {
        id,
        title: config.name,
        glCode: config.glCode,
        icon: config.icon,
        colorClass: config.colorClass,
        accentColor: config.accentColor,
        isCustom: !defaultIds.has(id),
        activeVal: activeVal || null,
        pendingVal: pendingVal || null,
        hasPendingDiff: activeVal !== undefined && pendingVal !== undefined && activeVal !== pendingVal
      };
    });
  };

  return (
    <Card className="shadow-none border-border overflow-hidden bg-background">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4 py-4 px-6">
        <CardTitle className="text-xs font-black uppercase shrink-0 tracking-wider text-muted-foreground/95">Expense Limits</CardTitle>
        <span className="text-[11px] font-semibold text-muted-foreground/80 bg-muted/65 px-2.5 py-1 rounded-full shrink-0 ml-auto">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} — page {safePage} of {totalPages || 1}
        </span>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[1000px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/15 hover:bg-muted/15 border-b border-border/50">
                <TableHead className="py-3.5 pl-6 w-[4%]"></TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider py-3.5 text-foreground/80 w-[18%]">User Details</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider py-3.5 text-foreground/80 w-[11%]">Department</TableHead>
                {BUDGET_COAS.map(coa => (
                  <TableHead key={coa.id} className="text-[11px] font-black uppercase tracking-wider py-3.5 text-right text-foreground/80 w-[11%]">
                    {coa.name}
                  </TableHead>
                ))}
                <TableHead className="text-[11px] font-black uppercase tracking-wider py-3.5 text-right text-foreground/80 w-[11%]">Total Limit</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider py-3.5 text-center text-foreground/80 w-[9%]">Status</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider py-3.5 pr-6 text-right text-foreground/80 w-[5%]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/40">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: j === 1 ? "140px" : "60px" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-sm text-destructive font-medium">
                    {error}
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-14 text-sm text-muted-foreground/80 font-medium">
                    No expense limits found. Click &quot;Add Limit&quot; to configure.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((l, i) => {
                  const displayLimits = l.limits || l.pending_limits;
                  const total = sumLimits(displayLimits);
                  const allCeilings = getAllCeilings(l);
                  const isExpanded = expandedUserId === l.user_id;
                  const customCeilings = allCeilings.filter(c => c.isCustom && (c.activeVal || c.pendingVal));
                  
                  let statusBadge = <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">Active</Badge>;
                  if (l.pending_limits) {
                    if (!l.limits) {
                      statusBadge = <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">Pending New</Badge>;
                    } else {
                      statusBadge = <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">Pending Edit</Badge>;
                    }
                  }

                  return (
                    <React.Fragment key={l.id}>
                      <TableRow className={`border-border/40 hover:bg-muted/15 cursor-pointer transition-colors duration-150 ${isExpanded ? 'bg-muted/10' : ''}`} onClick={() => toggleRow(l.user_id)}>
                        <TableCell className="py-4 pl-6 text-center">
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="py-4">
                          <p className="text-xs font-bold text-foreground/90">
                            {l.user_name ?? String(l.user_id)}
                          </p>
                          {l.user_email && (
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5 font-medium">{l.user_email}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-semibold py-4">
                          {l.user_department ?? "—"}
                        </TableCell>
                        
                        {/* 5 COA columns */}
                        {BUDGET_COAS.map(coa => {
                          const amt = displayLimits ? displayLimits[coa.id] : undefined;
                          const hasPendingDiff = l.limits && l.pending_limits && l.limits[coa.id] !== l.pending_limits[coa.id];
                          return (
                            <TableCell key={coa.id} className="text-xs py-4 text-right font-bold text-foreground/85">
                              <div>{amt ? formatPeso(amt) : "₱0.00"}</div>
                              {hasPendingDiff && (
                                <div className="text-[9px] text-blue-500 font-normal mt-0.5">
                                  Pending: {formatPeso(l.pending_limits![coa.id] || 0)}
                                </div>
                              )}
                            </TableCell>
                          );
                        })}

                        {/* Total */}
                        <TableCell className="text-xs font-black text-primary py-4 text-right whitespace-nowrap">
                          {formatPeso(total)}
                          {l.limits && l.pending_limits && sumLimits(l.limits) !== sumLimits(l.pending_limits) && (
                            <div className="text-[9px] text-blue-500 font-normal mt-0.5">
                              Pending: {formatPeso(sumLimits(l.pending_limits))}
                            </div>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-xs py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {statusBadge}
                            {customCeilings.length > 0 && (
                              <Badge variant="outline" className="text-[8px] bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold px-1.5 rounded">
                                +{customCeilings.length} Custom Account{customCeilings.length > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-4 pr-6 text-right" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => onEdit(l)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expandable detailed grid */}
                      {isExpanded && (
                        <TableRow className="bg-muted/5 hover:bg-muted/5 border-b border-border/40 select-none">
                          <TableCell colSpan={11} className="py-5 px-8">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Detailed Ceiling Limits Breakdown</p>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {allCeilings.map(c => {
                                  const hasVal = c.activeVal || c.pendingVal;
                                  return (
                                    <div 
                                      key={c.id} 
                                      className={`relative p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between overflow-hidden group bg-background shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md ${
                                        c.isCustom ? 'border-violet-500/20 hover:border-violet-500/40' : 'border-border hover:border-border-hover'
                                      } ${!hasVal ? 'opacity-40 hover:opacity-100' : ''}`}
                                    >
                                      {/* Accent color top line/corner gradient */}
                                      <div className={`absolute top-0 right-0 w-12 h-12 bg-gradient-to-br opacity-5 rounded-bl-full pointer-events-none ${c.accentColor}`} />
                                      
                                      <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-xl border shrink-0 ${c.colorClass}`}>
                                          <c.icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <h4 className="text-xs font-bold text-foreground truncate">{c.title}</h4>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[9px] text-muted-foreground font-semibold font-mono bg-muted px-1.5 py-0.5 rounded leading-none">{c.glCode}</span>
                                            {c.isCustom && (
                                              <Badge variant="outline" className="text-[8px] bg-purple-500/15 text-purple-600 border-none font-bold py-0 px-1 rounded h-3.5 leading-none">Custom</Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="mt-4 pt-3 border-t border-border/40">
                                        <span className="text-[9px] text-muted-foreground/80 block font-bold uppercase tracking-wider">Assigned Ceiling</span>
                                        {c.hasPendingDiff ? (
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-xs font-bold text-muted-foreground line-through">{formatPeso(c.activeVal || 0)}</span>
                                            <ArrowRight className="h-3 w-3 text-blue-500" />
                                            <span className="text-xs font-black text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">{formatPeso(c.pendingVal || 0)}</span>
                                          </div>
                                        ) : (
                                          <span className="text-xs font-black text-foreground/90 mt-1 block">
                                            {hasVal ? formatPeso(c.activeVal || c.pendingVal || 0) : "₱0.00"}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="py-4 border-t border-border/50">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={e => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                    aria-disabled={safePage === 1}
                    className={safePage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {pageNumbers.map((num, idx) =>
                  num === "ellipsis" ? (
                    <PaginationItem key={`e-${idx}`}><PaginationEllipsis /></PaginationItem>
                  ) : (
                    <PaginationItem key={num}>
                      <PaginationLink
                        href="#"
                        isActive={safePage === num}
                        onClick={e => { e.preventDefault(); setPage(num); }}
                      >
                        {num}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={e => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)); }}
                    aria-disabled={safePage === totalPages}
                    className={safePage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}