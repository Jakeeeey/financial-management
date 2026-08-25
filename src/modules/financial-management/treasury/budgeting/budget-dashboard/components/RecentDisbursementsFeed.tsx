"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptText, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

interface RecentDisbursementsFeedProps {
  data: { 
    id?: string; 
    payee?: { supplier_name?: string }; 
    payee_name?: string;
    department_id?: { department_name?: string }; 
    doc_no?: string; 
    total_amount?: number | string; 
    date_released?: string 
  }[];
}

export function RecentDisbursementsFeed({ data }: RecentDisbursementsFeedProps) {
  // Helper to generate a consistent color based on supplier name string
  const getSupplierColor = (name: string) => {
    const colors = [
      "bg-sky-500/10 text-sky-600 border-sky-500/20",
      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      "bg-amber-500/10 text-amber-600 border-amber-500/20",
      "bg-rose-500/10 text-rose-600 border-rose-500/20",
      "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-full min-h-[400px] flex flex-col">
      <CardHeader className="pb-3 shrink-0 border-b border-border/30">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <ReceiptText className="h-3 w-3 text-sky-500" />
          Recent Major Disbursements
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-sm font-medium text-muted-foreground/50 gap-2">
            <ReceiptText className="w-8 h-8 opacity-20" />
            No recent disbursements found.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/40">
            {data.map((item, idx) => {
              const supplierName = item.payee?.supplier_name || item.payee_name || "Unknown Payee";
              const avatarColor = getSupplierColor(supplierName);
              const initial = supplierName.charAt(0).toUpperCase();

              return (
                <div key={item.id || idx} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors group">
                  {/* Supplier Avatar */}
                  <div className={`flex items-center justify-center w-10 h-10 rounded-2xl border shrink-0 ${avatarColor} group-hover:scale-105 transition-transform`}>
                    <span className="text-lg font-black">{initial}</span>
                  </div>

                  {/* Details */}
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <p className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">
                      {supplierName}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        {item.department_id?.department_name || "Unknown Dept"}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {item.doc_no}
                      </span>
                    </div>
                  </div>

                  {/* Amount & Date */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                      -{formatCurrency(Number(item.total_amount || 0))}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {item.date_released ? format(new Date(item.date_released), "MMM dd") : "N/A"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
