"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText,
  Building2,
  Users2,
  Paperclip,
  FileSpreadsheet,
  Image as ImageIcon,
  ExternalLink,
  Download,
  MessageSquareText
} from "lucide-react";
import { useBudgetApprovalContext } from "../providers/BudgetApprovalProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { ApprovalActionDialog } from "./ApprovalActionDialog";

import { getBudgetStatusColor as getStatusColor, formatCurrency as fmt } from "../utils";

export function BudgetApprovalTable() {
  const {
    displayedItems,
    loading,
    initialLoading,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    approveBudget,
    rejectBudget,
    filters
  } = useBudgetApprovalContext();

  const [actionConfig, setActionConfig] = useState<{
    id: string;
    type: "approve" | "reject";
    isOpen: boolean;
  } | null>(null);

  const isPendingTab = filters.status === "Pending";

  if (initialLoading) {
    return (
      <div className="w-full space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (displayedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 w-full border-2 border-dashed rounded-3xl bg-muted/20 gap-3 opacity-60">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-widest">No budgets found</p>
          <p className="text-xs font-medium text-muted-foreground">Try adjusting your filters or search term.</p>
        </div>
      </div>
    );
  }

  const handleActionConfirm = (remarks: string) => {
    if (!actionConfig) return;
    if (actionConfig.type === "approve") approveBudget(actionConfig.id, remarks);
    if (actionConfig.type === "reject") rejectBudget(actionConfig.id, remarks);
    setActionConfig(null);
  };

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border/50 bg-card shadow-sm">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/40">
              {isPendingTab && (
                <TableHead className="w-[50px] pl-6">
                  <Checkbox 
                    checked={selectedIds.size > 0 && selectedIds.size === displayedItems.length}
                    onCheckedChange={() => toggleSelectAll()}
                  />
                </TableHead>
              )}
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4">Budget Details</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Department / Division</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedItems.map((budget) => (
              <TableRow 
                key={budget.id} 
                className="group border-border/30 hover:bg-muted/10 transition-colors"
              >
                {isPendingTab && (
                  <TableCell className="pl-6">
                    <Checkbox 
                      checked={selectedIds.has(String(budget.id))}
                      onCheckedChange={() => toggleSelect(String(budget.id))}
                    />
                  </TableCell>
                )}
                
                {/* Budget Details */}
                <TableCell className="py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                       <FileText className="h-3.5 w-3.5 text-primary/60" />
                       <span className="text-xs font-black tracking-tight uppercase">{budget.budget_no}</span>
                       <Badge variant="outline" className={`h-4 text-[8px] font-bold ${getStatusColor(budget.status)}`}>
                         {budget.status}
                       </Badge>

                       {/* Attachment Popover */}
                       {budget.attachments && budget.attachments.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-4 w-5 p-0 hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
                            >
                              <Paperclip className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3 rounded-2xl shadow-xl border-border/50 bg-card/95 backdrop-blur-sm" align="start">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                  <Paperclip className="h-3 w-3" />
                                  Attachments ({budget.attachments.length})
                                </h4>
                              </div>
                              <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
                                {budget.attachments.map((att) => {
                                  const isImage = att.file_type?.startsWith("image/");
                                  const isExcel = att.file_type?.includes("spreadsheet") || att.file_name?.endsWith(".xlsx") || att.file_name?.endsWith(".xls");
                                  const isPdf = att.file_type === "application/pdf" || att.file_name?.endsWith(".pdf");
                                  const fileUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${att.directus_id}`;

                                  return (
                                    <div 
                                      key={att.id} 
                                      className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/20 hover:bg-muted/50 transition-colors group/item"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className={`p-1.5 rounded-lg shrink-0 ${
                                          isImage ? 'bg-orange-100 text-orange-600' :
                                          isExcel ? 'bg-emerald-100 text-emerald-600' :
                                          isPdf   ? 'bg-rose-100 text-rose-600' :
                                          'bg-blue-100 text-blue-600'
                                        }`}>
                                          {isImage ? <ImageIcon className="h-3 w-3" /> :
                                           isExcel ? <FileSpreadsheet className="h-3 w-3" /> :
                                           <FileText className="h-3 w-3" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-[10px] font-bold truncate tracking-tight text-foreground/90 leading-none mb-1">
                                            {att.file_name}
                                          </span>
                                          <span className="text-[8px] font-mono opacity-40 uppercase">
                                            {(att.file_size / 1024).toFixed(1)} KB
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                        <a 
                                          href={fileUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                        <a 
                                          href={`${fileUrl}?download`} 
                                          download={att.file_name}
                                          className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
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
                    <p className="text-[11px] font-bold text-muted-foreground tracking-tight uppercase truncate max-w-[200px]">
                      {budget.coa_name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-medium opacity-40">{budget.gl_code}</span>
                      {budget.remarks && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="link" 
                              className="h-auto p-0 text-[10px] font-medium text-muted-foreground hover:text-foreground italic truncate max-w-[150px] justify-start gap-1 leading-none transition-colors"
                            >
                              <MessageSquareText className="h-2.5 w-2.5 shrink-0 opacity-60" />
                              <span className="truncate">{budget.remarks}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-4 rounded-2xl shadow-xl border-border/50 bg-card/95 backdrop-blur-sm z-50" align="start" sideOffset={5}>
                            <div className="flex flex-col gap-2.5">
                              <div className="flex items-center gap-1.5 border-b border-border/40 pb-2">
                                <MessageSquareText className="h-3.5 w-3.5 text-primary" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground">
                                  Budget Remarks / Justification
                                </h4>
                              </div>
                              <div className="max-h-[200px] overflow-y-auto scrollbar-thin text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {budget.remarks}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Dept/Div */}
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter">
                      <Building2 className="h-3 w-3 text-muted-foreground/60" />
                      {budget.division_name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                      <Users2 className="h-3 w-3 text-muted-foreground/40" />
                      {budget.department_name}
                    </div>
                  </div>
                </TableCell>

                {/* Amount */}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs font-mono font-black tabular-nums tracking-tighter">
                      {fmt(budget.amount)}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                      {budget.month_name} {budget.year}
                    </span>
                  </div>
                </TableCell>

                {/* Type */}
                <TableCell>
                  <Badge variant="secondary" className={`h-5 text-[8px] font-black uppercase tracking-widest border-none ${
                    budget.entry_type === 'original' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                  }`}>
                    {budget.entry_type}
                  </Badge>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right pr-6">
                  {budget.status === "Pending" ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionConfig({ id: String(budget.id), type: "reject", isOpen: true })}
                        className="h-8 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all active:scale-95 shadow-sm"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionConfig({ id: String(budget.id), type: "approve", isOpen: true })}
                        className="h-8 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 rounded-lg border border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all active:scale-95 shadow-sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2 opacity-30 grayscale pointer-events-none">
                      <Badge variant="outline" className="h-6 px-3 text-[8px] font-black uppercase tracking-widest bg-muted/50 border-border/40">
                         Processed
                      </Badge>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {actionConfig && (
        <ApprovalActionDialog 
          isOpen={actionConfig.isOpen}
          onClose={() => setActionConfig(null)}
          onConfirm={handleActionConfirm}
          type={actionConfig.type}
          count={1}
          loading={loading}
        />
      )}
    </div>
  );
}
