"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  ChevronRight,
  Loader2,
  Send,
  Pencil,
  Trash2,
  Plus,
  ChevronDown,
  Building2,
  Layers,
  Paperclip,
  Image as ImageIcon,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Download,
} from "lucide-react";

import { useCreateBudgetContext } from "../providers/CreateBudgetProvider";
import { getMonthName, getBudgetStatusColor } from "../utils";
import type { Budget } from "../types";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);

// ─── Data Transformation ───────────────────────────────────────────────────────

interface AttachmentFile {
  id?: string | number;
  directus_id?: string;
  type?: string;
  name?: string;
  size?: number;
  url?: string;
}

interface WithAttachments {
  attachments?: AttachmentFile[];
}

interface BudgetNode extends Budget {
  supplements: Budget[];
}

interface DepartmentGroup {
  department_name: string;
  budgets: BudgetNode[];
  subtotal: number;
}

interface DivisionGroup {
  division_name: string;
  departments: DepartmentGroup[];
  total: number;
}

function groupBudgets(items: Budget[] = [], allItems: Budget[] = []): DivisionGroup[] {
  // Helper to calculate grand total within this grouping function
  const calcGrandTotal = (budgetId: string, amount: number) => {
    // If we don't have the full list, we just return the amount for now
    // or we filter from the current items
    const approvedSupplements = (allItems || []).filter(
      b => String(b.parent_budget_id) === String(budgetId) && 
           b.entry_type === "supplemental" && 
           b.status === "Approved"
    );
    return Number(amount || 0) + approvedSupplements.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  };

  // Separate parents from supplements
  const parents = (items || []).filter(b => b && b.entry_type !== "supplemental");
  const supplements = (items || []).filter(b => b && b.entry_type === "supplemental");


  // Attach supplements to their parents IF the parent is in the list
  const nodes: BudgetNode[] = parents.map(p => ({
    ...p,
    supplements: supplements.filter(s => String(s.parent_budget_id) === String(p.id)),
  }));

  // Find supplements whose parents ARE NOT in the current list (e.g. Draft supplement of an Approved parent)
  const orphanedSupplements = supplements.filter(s => !parents.some(p => String(p.id) === String(s.parent_budget_id)));
  
  // Add orphans as standalone nodes (they will be rendered like parents but with supplement style)
  const allNodes: BudgetNode[] = [
    ...nodes,
    ...orphanedSupplements.map(s => ({ ...s, supplements: [] }))
  ];

  // Group by division → department
  const divMap = new Map<string, Map<string, BudgetNode[]>>();
  for (const node of allNodes) {
    const divKey = node.division_name || "Uncategorized";
    const deptKey = node.department_name || "Uncategorized";
    if (!divMap.has(divKey)) divMap.set(divKey, new Map());
    const deptMap = divMap.get(divKey)!;
    if (!deptMap.has(deptKey)) deptMap.set(deptKey, []);
    deptMap.get(deptKey)!.push(node);
  }

  // Build hierarchy
  return Array.from(divMap.entries()).map(([division_name, deptMap]) => {
    const departments: DepartmentGroup[] = Array.from(deptMap.entries()).map(
      ([department_name, budgets]) => {
        // Subtotal now includes the Grand Totals (Original + Approved Supplements)
        const subtotal = budgets.reduce((sum, b) => sum + calcGrandTotal(String(b.id), Number(b.amount || 0)), 0);
        return { department_name, budgets, subtotal };
      }
    );
    const total = departments.reduce((sum, d) => sum + d.subtotal, 0);
    return { division_name, departments, total };
  });
}

// ─── Row Components ────────────────────────────────────────────────────────────

function SupplementRow({ supplement, showCheckbox }: { supplement: Budget; showCheckbox: boolean }) {
  const suppAtts = ((supplement as unknown as WithAttachments).attachments || []);
  return (
    <tr className="bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30">
      {/* Checkbox placeholder */}
      {showCheckbox && <td className="py-2 pl-4 w-[50px]" />}
      {/* COA / GL Code — Deeply indented (Level 4: 128px) with Tree Lines */}
      <td className="py-2 pl-32 relative" colSpan={showCheckbox ? 2 : 3}>
        {/* Tree Lines for Supplement (Nested under Budget) */}
        <div className="absolute left-[47px] top-0 bottom-0 w-px bg-border/30" />
        <div className="absolute left-[79px] top-0 bottom-0 w-px bg-border/30" />
        <div className="absolute left-[79px] top-1/2 w-4 h-px bg-border/30" />
        
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-5 rounded-full bg-blue-300 dark:bg-blue-600 shrink-0" />
          <div>
            <div className="flex items-center flex-wrap gap-1.5">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                {supplement.coa_name}
              </p>
              <Badge className="h-4 px-1.5 text-[9px] font-black tracking-tight text-blue-600 bg-blue-100 border-none uppercase">
                SUPPLEMENTAL
              </Badge>
              {suppAtts.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 py-0 bg-blue-100/50 hover:bg-blue-200/50 text-blue-700 dark:text-blue-400 rounded gap-1 active:scale-95 transition-all"
                    >
                      <Paperclip className="h-3 w-3" />
                      <span className="text-[10px] font-bold tabular-nums leading-none">
                        {suppAtts.length}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-3 rounded-2xl shadow-xl border-border/40 backdrop-blur-sm z-50">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <span className="text-xs font-black tracking-tight flex items-center gap-1.5 text-foreground">
                          <Paperclip className="h-3.5 w-3.5 text-primary" />
                          Supporting Documents
                        </span>
                        <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0">
                          {suppAtts.length} {suppAtts.length === 1 ? "File" : "Files"}
                        </Badge>
                      </div>
                      <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                        {suppAtts.map((file: AttachmentFile) => {
                          const isImg = file.type?.includes("image");
                          const isExcel = file.type?.includes("spreadsheet") || file.type?.includes("excel") || file.name?.endsWith(".xlsx") || file.name?.endsWith(".xls");
                          const isPdf = file.type?.includes("pdf") || file.name?.endsWith(".pdf");
                          
                          return (
                            <div 
                              key={file.id || file.directus_id} 
                              className="flex items-start gap-2.5 p-2 rounded-xl bg-muted/40 hover:bg-muted/80 border border-border/30 transition-colors group"
                            >
                              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                isImg ? "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400" :
                                isExcel ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" :
                                isPdf ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" :
                                "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                              }`}>
                                {isImg ? <ImageIcon className="h-3.5 w-3.5" /> :
                                 isExcel ? <FileSpreadsheet className="h-3.5 w-3.5" /> :
                                 <FileText className="h-3.5 w-3.5" />}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-foreground truncate leading-tight" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "—"}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center">
                                <a 
                                  href={file.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                                  title="Open External Link"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                                <a 
                                  href={file.url} 
                                  download={file.name}
                                  className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                                  title="Download File"
                                >
                                  <Download className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <p className="text-[11px] font-mono text-blue-500/80">{supplement.gl_code}</p>
          </div>
        </div>
      </td>
      {/* Amount */}
      <td className="py-2 text-xs font-bold text-blue-700 dark:text-blue-400">
        +{fmt(supplement.amount || 0)}
      </td>
      {/* Status */}
      <td className="py-2">
        <Badge
          variant="outline"
          className={`text-[10px] uppercase tracking-wider font-bold h-5 px-2 rounded-full ${getBudgetStatusColor(supplement.status)}`}
        >
          {supplement.status}
        </Badge>
      </td>
      {/* Actions — empty for supplements */}
      <td className="py-2 pr-4" />
    </tr>
  );
}

function BudgetRow({
  node,
  selectedIds,
  toggleSelect,
  submitForApproval,
  openEditModal,
  openSupplementModal,
  deleteBudget,
  getGrandTotal,
  hasInFlightSupplement,
  activeStatus,
}: {
  node: BudgetNode;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  submitForApproval: (id: string) => void;
  openEditModal: (b: Budget) => void;
  openSupplementModal: (b: Budget) => void;
  deleteBudget: (id: string) => void;
  getGrandTotal: (id: string) => number;
  hasInFlightSupplement: (id: string) => boolean;
  activeStatus: string;
}) {
  const [supplementsOpen, setSupplementsOpen] = useState(false);
  const showCheckbox = activeStatus === "Draft" || activeStatus === "Rejected";
  const hasSubs = node.supplements.length > 0;
  const grandTotal = getGrandTotal(String(node.id));
  const inFlight = hasInFlightSupplement(String(node.id));
  const nodeAtts = ((node as unknown as WithAttachments).attachments || []);

  return (
    <>
      <tr className="group border-b border-border/40 hover:bg-muted/30 transition-colors">
        {/* Checkbox */}
        {showCheckbox && (
          <td className="py-3 pl-4 w-[50px]">
            <Checkbox
              checked={selectedIds.has(String(node.id))}
              onCheckedChange={() => toggleSelect(String(node.id))}
              aria-label={`Select budget ${node.id}`}
            />
          </td>
        )}

        {/* COA / GL Code — Indented (Level 3: 96px) with Tree Lines */}
        <td className="py-3 pl-24 relative" colSpan={showCheckbox ? 2 : 3}>
          {/* Tree Lines for Budget Item (Nested under Department) */}
          <div className="absolute left-[47px] top-0 bottom-0 w-px bg-border/30" />
          <div className="absolute left-[47px] top-1/2 w-4 h-px bg-border/30" />

          <div className="flex items-center gap-1.5">
            {hasSubs && (
              <button
                onClick={() => setSupplementsOpen(o => !o)}
                className="shrink-0 -ml-5 mr-1 z-10 bg-card text-muted-foreground hover:text-foreground transition-colors"
                title={supplementsOpen ? "Hide Supplements" : "View Supplements"}
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${supplementsOpen ? "rotate-90" : ""}`}
                />
              </button>
            )}
            <div>
              <div className="flex items-center flex-wrap gap-1.5">
                <p className="text-xs font-medium text-foreground">{node.coa_name}</p>
                {node.entry_type === "supplemental" && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-black tracking-tight text-blue-600 bg-blue-100 border-none uppercase">
                    SUPPLEMENTAL
                  </Badge>
                )}
                {hasSubs && (
                  <Badge 
                    variant="outline" 
                    className="h-4 px-1.5 text-[9px] font-bold tracking-tight text-blue-600 border-blue-200 bg-blue-50/50 cursor-pointer hover:bg-blue-100/50 active:scale-95 transition-all"
                    onClick={() => setSupplementsOpen(o => !o)}
                    title="Click to toggle supporting nested records"
                  >
                    {node.supplements.length} {node.supplements.length === 1 ? "Supplement" : "Supplements"}
                  </Badge>
                )}
                {nodeAtts.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 py-0 bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded gap-1 active:scale-95 transition-all"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="text-[10px] font-bold tabular-nums leading-none">
                          {nodeAtts.length}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 p-3 rounded-2xl shadow-xl border-border/40 backdrop-blur-sm z-50">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <span className="text-xs font-black tracking-tight flex items-center gap-1.5 text-foreground">
                            <Paperclip className="h-3.5 w-3.5 text-primary" />
                            Supporting Documents
                          </span>
                          <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0">
                            {nodeAtts.length} {nodeAtts.length === 1 ? "File" : "Files"}
                          </Badge>
                        </div>
                        <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                          {nodeAtts.map((file: AttachmentFile) => {
                            const isImg = file.type?.includes("image");
                            const isExcel = file.type?.includes("spreadsheet") || file.type?.includes("excel") || file.name?.endsWith(".xlsx") || file.name?.endsWith(".xls");
                            const isPdf = file.type?.includes("pdf") || file.name?.endsWith(".pdf");
                            
                            return (
                              <div 
                                key={file.id || file.directus_id} 
                                className="flex items-start gap-2.5 p-2 rounded-xl bg-muted/40 hover:bg-muted/80 border border-border/30 transition-colors group"
                              >
                                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                  isImg ? "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400" :
                                  isExcel ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" :
                                  isPdf ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" :
                                  "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                                }`}>
                                  {isImg ? <ImageIcon className="h-3.5 w-3.5" /> :
                                   isExcel ? <FileSpreadsheet className="h-3.5 w-3.5" /> :
                                   <FileText className="h-3.5 w-3.5" />}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-foreground truncate leading-tight" title={file.name}>
                                    {file.name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                    {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "—"}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center">
                                  <a 
                                    href={file.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                                    title="Open External Link"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                  <a 
                                    href={file.url} 
                                    download={file.name}
                                    className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                                    title="Download File"
                                  >
                                    <Download className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <p className="text-[11px] font-mono text-primary/80">
                {node.gl_code} • <span className="opacity-60">{node.budget_no}</span>
              </p>
            </div>
          </div>
        </td>

        {/* Proposed Amount + Grand Total */}
        <td className="py-3">
          {node.status === "Approved" && hasSubs && grandTotal > node.amount ? (
            <div>
              <p className="text-xs font-black text-foreground">{fmt(grandTotal)}</p>
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="text-[9px] font-mono text-muted-foreground">Base: {fmt(node.amount || 0)}</span>
                <span className="text-[9px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                  ⁺ {fmt(grandTotal - Number(node.amount || 0))} (Supplements)
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs font-bold text-foreground">{fmt(node.amount || 0)}</p>
          )}
        </td>

        {/* Status */}
        <td className="py-3">
          <Badge
            variant="outline"
            className={`text-[10px] uppercase tracking-wider font-bold h-5 px-2 rounded-full ${getBudgetStatusColor(node.status)}`}
          >
            {node.status}
          </Badge>
        </td>

        {/* Actions */}
        <td className="py-3 pr-4 text-right">
          <div className="flex items-center justify-end gap-1">
            {(node.status === "Draft" || node.status === "Rejected") && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(node)}
                  className="h-8 px-2 text-xs gap-1.5 hover:bg-muted transition-all active:scale-95"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {node.status === "Rejected" ? "Resubmit" : "Submit"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {node.status === "Rejected" ? "Resubmit for Approval?" : "Submit for Approval?"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {node.status === "Rejected" 
                          ? "Are you sure you want to resubmit this budget for approval after your revisions?"
                          : "Are you sure you want to submit this budget entry for approval? Once submitted, it will no longer be in draft status."
                        }
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => submitForApproval(String(node.id))}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Submit
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs gap-1.5 hover:bg-destructive/10 hover:text-destructive transition-all active:scale-95"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this draft budget entry.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteBudget(String(node.id))}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {node.status === "Approved" && node.entry_type !== "supplemental" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={inFlight}
                onClick={() => openSupplementModal(node)}
                title={inFlight ? "A supplement is already Draft or Pending" : "Request additional funding"}
                className={`h-8 px-2 text-xs gap-1.5 transition-all active:scale-95 ${
                  inFlight
                    ? "opacity-50 cursor-not-allowed text-muted-foreground"
                    : "hover:bg-blue-50 hover:text-blue-600 text-muted-foreground"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                {inFlight ? "Supplement Pending" : "Request Supplement"}
              </Button>
            )}
          </div>
        </td>
      </tr>

      {/* Supplement Rows */}
      {hasSubs && supplementsOpen &&
        node.supplements.map(s => <SupplementRow key={s.id} supplement={s} showCheckbox={showCheckbox} />)
      }
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function CreateBudgetGroupedTable() {
  const {
    displayedItems,
    initialLoading,
    loading,
    hasMore,
    loadMore,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    submitForApproval,
    openEditModal,
    openSupplementModal,
    openModal,
    deleteBudget,
    getGrandTotal,
    hasInFlightSupplement,
    total,
    filters,
  } = useCreateBudgetContext();


  const activeStatus = filters.status;
  const showCheckbox = activeStatus === "Draft" || activeStatus === "Rejected";

  const [collapsedDivisions, setCollapsedDivisions] = useState<Set<string>>(new Set());
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());

  // Infinite scroll sentinel
  const observer = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading || initialLoading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasMore) loadMore();
      });
      if (node) observer.current.observe(node);
    },
    [loading, initialLoading, hasMore, loadMore]
  );

  const grouped = useMemo(() => groupBudgets(displayedItems, displayedItems), [displayedItems]);


  const toggleDiv = (key: string) =>
    setCollapsedDivisions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const toggleDept = (key: string) =>
    setCollapsedDepts(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  // All selectable (non-supplement) ids
  const allIds = displayedItems.filter(b => b.entry_type !== "supplemental").map(b => String(b.id));
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));

  if (initialLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 min-w-0 flex-1 gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground font-medium">
          Showing {displayedItems.length} of {total} budgets
        </span>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-md">
            <tr className="border-b border-border">
              {showCheckbox && (
                <th className="w-[50px] py-3 pl-4 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="py-3 pl-24 text-left text-xs font-bold" colSpan={showCheckbox ? 2 : 3}>COA / GL Code</th>
              <th className="py-3 text-left text-xs font-bold">Proposed Amount</th>
              <th className="py-3 text-left text-xs font-bold w-[120px]">Status</th>
              <th className="py-3 pr-4 text-right text-xs font-bold w-[220px]">
                {activeStatus !== "Pending" ? "Action" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-24">
                  <div className="flex flex-col items-center justify-center w-full min-h-[300px] gap-4 animate-in fade-in zoom-in duration-500">
                    <div className="p-8 rounded-full bg-muted/20 border border-border/40 shadow-inner">
                        <Layers className="h-14 w-14 text-muted-foreground/30" />
                    </div>
                    <div className="max-w-[320px] text-center space-y-2">
                        <p className="text-xl font-black tracking-tighter uppercase text-foreground/90">No Budgets Found</p>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                            It looks like there are no budget entries for <span className="text-primary font-bold">{getMonthName(Number(filters.month))} {filters.year}</span> that match your search.
                        </p>
                    </div>
                    <Button 
                        variant="outline"
                        size="sm" 
                        onClick={openModal}
                        className="mt-4 rounded-xl h-10 px-8 font-black border-2 border-emerald-600/20 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-600/40 transition-all shadow-sm active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Budget
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              grouped.map(division => {
                const divKey = division.division_name;
                const isDivCollapsed = collapsedDivisions.has(divKey);

                return (
                  <React.Fragment key={divKey}>
                    {/* ── Division Header — Level 1 ── */}
                    <tr
                      className="bg-gradient-to-r from-primary/10 to-transparent border-b border-primary/15 border-l-4 border-l-primary cursor-pointer select-none hover:from-primary/15 transition-colors"
                      onClick={() => toggleDiv(divKey)}
                    >
                      <td className="py-2.5 pl-4" colSpan={3}>
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 text-primary transition-transform duration-200 ${isDivCollapsed ? "-rotate-90" : ""}`}
                          />
                          <Building2 className="h-3.5 w-3.5 text-primary/70" />
                          <span className="text-xs font-black tracking-tight uppercase text-primary">
                            {division.division_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span className="text-xs font-black text-primary">
                          {fmt(division.total)}
                        </span>
                      </td>
                      <td className="py-2.5" colSpan={2} />
                    </tr>

                    {!isDivCollapsed && division.departments.map(dept => {
                      const deptKey = `${divKey}::${dept.department_name}`;
                      const isDeptCollapsed = collapsedDepts.has(deptKey);

                      return (
                        <React.Fragment key={deptKey}>
                          {/* ── Department Header — Level 2 ── */}
                          <tr
                            className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/40 border-l-4 border-l-muted-foreground/30 cursor-pointer select-none hover:from-muted/70 transition-colors"
                            onClick={() => toggleDept(deptKey)}
                          >
                            <td className="py-2 pl-10" colSpan={3}>
                              <div className="flex items-center gap-2">
                                <ChevronRight
                                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isDeptCollapsed ? "" : "rotate-90"}`}
                                />
                                <Layers className="h-3 w-3 text-muted-foreground/70" />
                                <span className="text-xs font-semibold text-foreground/80">
                                  {dept.department_name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2">
                              <span className="text-xs font-bold text-muted-foreground">
                                {fmt(dept.subtotal)}
                              </span>
                            </td>
                            <td className="py-2" colSpan={2} />
                          </tr>

                          {/* ── Budget Rows ── */}
                          {!isDeptCollapsed && dept.budgets.map(node => (
                            <BudgetRow
                              key={node.id}
                              node={node}
                              selectedIds={selectedIds}
                              toggleSelect={toggleSelect}
                              submitForApproval={submitForApproval}
                              openEditModal={openEditModal}
                              openSupplementModal={openSupplementModal}
                              deleteBudget={deleteBudget}
                              getGrandTotal={getGrandTotal}
                              hasInFlightSupplement={hasInFlightSupplement}
                              activeStatus={activeStatus}
                            />
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}

            {loading && (
              <tr>
                <td colSpan={6} className="py-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading more...
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Invisible infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  );
}
