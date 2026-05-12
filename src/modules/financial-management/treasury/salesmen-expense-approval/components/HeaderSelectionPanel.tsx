// src/modules/financial-management/treasury/salesmen-expense-approval/components/HeaderSelectionPanel.tsx
"use client";

import * as React from "react";
import { X, Calendar, ChevronRight, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SalesmanExpenseDetail, ExpenseHeader, SalesmanExpenseRow } from "../type";

interface Props {
  selectedSalesman: SalesmanExpenseRow | null;
  detail: SalesmanExpenseDetail | null;
  loading: boolean;
  onClose: () => void;
  onSelectHeader: (header: ExpenseHeader) => void;
}

export default function HeaderSelectionPanel({ selectedSalesman, detail, loading, onClose, onSelectHeader }: Props) {
  if (!selectedSalesman) return null;

  return (
    <div className="flex flex-col h-full bg-card animate-in slide-in-from-right duration-300 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-muted/5">
        <div>
          <h3 className="font-black text-sm uppercase tracking-wider text-slate-800">Select Submittal Period</h3>
          <p className="text-[10px] text-muted-foreground font-bold">{selectedSalesman.salesman_name}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 hover:bg-rose-50 hover:text-rose-600 transition-colors">
          <X size={18} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading Periods...</p>
          </div>
        ) : detail?.headers && detail.headers.length > 0 ? (
          detail.headers.map((header) => {
             const headerItems = detail.expenses.filter(e => Number(e.header_id) === header.id);
             const itemCount = headerItems.length;
             const totalAmount = headerItems.reduce((sum, e) => sum + Number(e.amount), 0);

             return (
               <button
                 key={header.id}
                 onClick={() => onSelectHeader(header)}
                 className="w-full text-left p-4 rounded-2xl border bg-white hover:border-primary hover:shadow-xl hover:-translate-y-0.5 transition-all group flex items-center justify-between"
               >
                 <div className="space-y-1">
                   <div className="flex items-center gap-2">
                     <div className="p-1.5 bg-primary/5 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <Calendar size={12} />
                     </div>
                     <span className="text-[11px] font-black text-slate-800">
                       {new Date(header.period_from + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })} - {new Date(header.period_to + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                     </span>
                   </div>
                   <div className="flex items-center gap-2 pl-8">
                      <Badge variant="outline" className="text-[9px] font-black px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-100 tabular-nums">
                        ₱{totalAmount.toLocaleString()}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 bg-slate-50 border-slate-200">
                        {itemCount} Line{itemCount !== 1 ? 's' : ''}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground italic truncate max-w-[80px]">
                        {header.remarks || "No remarks"}
                      </span>
                   </div>
                 </div>
                 <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-inner">
                    <ChevronRight size={16} />
                 </div>
               </button>
             );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center space-y-2">
            <FileText className="h-8 w-8 text-slate-200" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">No Submittals Found</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-muted/10 border-t mt-auto">
        <p className="text-[9px] text-muted-foreground font-black text-center uppercase tracking-widest leading-relaxed">
          PICK A PERIOD TO INITIATE<br/>THE AUDIT WORKSPACE
        </p>
      </div>
    </div>
  );
}
