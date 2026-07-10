// src/modules/financial-management/treasury/expense-approval/user-expense-limit-approval/components/ApprovalTable.tsx

"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from "@/components/ui/pagination";
import type { PendingLimitApproval } from "../../user-expense-limit/types";
import { formatPeso, BUDGET_COAS } from "../../user-expense-limit/utils";
import { useCoas } from "../../user-expense-limit/hooks/useUserExpenseLimit";
import { getCoaConfig } from "../../user-expense-limit/components/LimitTable";

const PAGE_SIZE = 10;

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

interface ApprovalTableProps {
  pendingList: PendingLimitApproval[];
  loading:     boolean;
  error:       string | null;
  onReview:    (proposal: PendingLimitApproval) => void;
}

export function ApprovalTable({ pendingList, loading, error, onReview }: ApprovalTableProps) {
  const [page, setPage] = useState(1);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const { coas } = useCoas();

  const totalPages = Math.ceil(pendingList.length / PAGE_SIZE);
  const safePage = Math.min(page, totalPages || 1);
  const paged = pendingList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  const sumLimits = (limObj: Record<number, string>): number => {
    return Object.values(limObj).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };

  const toggleRow = (userId: number) => {
    setExpandedUserId(prev => (prev === userId ? null : userId));
  };

  const getAllCeilings = (p: PendingLimitApproval) => {
    const allCoaIds = new Set(BUDGET_COAS.map(c => c.id));
    Object.keys(p.limits).forEach(id => allCoaIds.add(Number(id)));

    return Array.from(allCoaIds).map(id => {
      const coaDetail = coas.find(c => c.coa_id === id);
      const config = getCoaConfig(id, coaDetail?.account_title, coaDetail?.gl_code);
      const val = p.limits[id];
      const defaultIds = new Set(BUDGET_COAS.map(c => c.id));

      return {
        id,
        title: config.name,
        glCode: config.glCode,
        icon: config.icon,
        colorClass: config.colorClass,
        accentColor: config.accentColor,
        isCustom: !defaultIds.has(id),
        val: val || null
      };
    });
  };

  return (
    <Card className="shadow-none border-border overflow-hidden bg-background">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4 py-4 px-6">
        <CardTitle className="text-xs font-black uppercase shrink-0 tracking-wider text-muted-foreground/95">Pending Approvals</CardTitle>
        <span className="text-[11px] font-semibold text-muted-foreground/80 bg-muted/65 px-2.5 py-1 rounded-full shrink-0 ml-auto">
          {pendingList.length} request{pendingList.length !== 1 ? "s" : ""} — page {safePage} of {totalPages || 1}
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
                <TableHead className="text-[11px] font-black uppercase tracking-wider py-3.5 text-right text-foreground/80 w-[11%]">Proposed Total</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider py-3.5 text-foreground/80 w-[12%]">Proposed By</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider py-3.5 pr-6 text-right text-foreground/80 w-[5%]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="border-border/40">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: j === 1 ? "120px" : "60px" }} />
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
                  <TableCell colSpan={11} className="text-center py-14 text-sm text-muted-foreground/85 font-medium">
                    No pending expense limit requests awaiting approval.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map(p => {
                  const total = sumLimits(p.limits);
                  const allCeilings = getAllCeilings(p);
                  const isExpanded = expandedUserId === p.user_id;
                  const customCeilings = allCeilings.filter(c => c.isCustom && c.val);

                  return (
                    <React.Fragment key={p.id}>
                      <TableRow className={`border-border/40 hover:bg-muted/15 cursor-pointer transition-colors duration-150 ${isExpanded ? 'bg-muted/10' : ''}`} onClick={() => toggleRow(p.user_id)}>
                        <TableCell className="py-4 pl-6 text-center">
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="py-4">
                          <p className="text-xs font-bold text-foreground/90">
                            {p.user_name ?? `User #${p.user_id}`}
                          </p>
                          {p.user_email && (
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5 font-medium">{p.user_email}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-semibold py-4">
                          {p.user_department ?? "—"}
                        </TableCell>

                        {/* 5 COA columns */}
                        {BUDGET_COAS.map(coa => {
                          const amt = p.limits[coa.id];
                          return (
                            <TableCell key={coa.id} className="text-xs py-4 text-right font-bold text-foreground/85">
                              {amt ? formatPeso(amt) : "₱0.00"}
                            </TableCell>
                          );
                        })}

                        {/* Total */}
                        <TableCell className="text-xs font-black text-primary py-4 text-right whitespace-nowrap">
                          {formatPeso(total)}
                          {customCeilings.length > 0 && (
                            <div className="text-[9px] text-purple-600 font-normal mt-0.5">
                              +{customCeilings.length} Custom COA{customCeilings.length > 1 ? "s" : ""}
                            </div>
                          )}
                        </TableCell>

                        {/* Proposed By */}
                        <TableCell className="text-xs text-muted-foreground font-semibold py-4">
                          <p className="font-bold text-foreground/80">{p.created_by_name ?? "—"}</p>
                          {p.created_at && (
                            <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-medium">
                              {new Date(p.created_at).toLocaleDateString()}
                            </p>
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="py-4 pr-6 text-right" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 border-border hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all font-semibold"
                            onClick={() => onReview(p)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Collapsible Details */}
                      {isExpanded && (
                        <TableRow className="bg-muted/5 hover:bg-muted/5 border-b border-border/40 select-none">
                          <TableCell colSpan={11} className="py-5 px-8">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Proposed Ceiling Limits Breakdown</p>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {allCeilings.map(c => {
                                  const hasVal = c.val !== null;
                                  return (
                                    <div 
                                      key={c.id} 
                                      className={`relative p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between overflow-hidden group bg-background shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md ${
                                        c.isCustom ? 'border-violet-500/20 hover:border-violet-500/40' : 'border-border hover:border-border-hover'
                                      } ${!hasVal ? 'opacity-40 hover:opacity-100' : ''}`}
                                    >
                                      {/* Accent color gradient */}
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
                                        <span className="text-[9px] text-muted-foreground/80 block font-bold uppercase tracking-wider">Proposed Ceiling</span>
                                        <span className="text-xs font-black text-foreground/90 mt-1 block">
                                          {hasVal ? formatPeso(c.val || 0) : "₱0.00"}
                                        </span>
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
