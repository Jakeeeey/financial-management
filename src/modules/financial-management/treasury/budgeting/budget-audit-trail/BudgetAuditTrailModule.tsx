"use client";

import { useBudgetAuditTrail } from "./hooks/useBudgetAuditTrail";
import { AuditTrailTable } from "./components/AuditTrailTable";
import { AuditTrailFilters } from "./components/AuditTrailFilters";
import { History, Download, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BudgetAuditTrailModule() {
  const { 
    logs, 
    filters, 
    updateFilter, 
    clearFilters, 
    loading, 
    total 
  } = useBudgetAuditTrail();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-0 min-w-0 flex-1">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-primary/10 rounded-xl">
                <History className="h-5 w-5 text-primary" />
             </div>
             <h1 className="text-2xl font-black tracking-tighter uppercase">Budget Audit Trail</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            Track all modifications, approvals, and transaction history for department budgets.
          </p>
        </div>

        <div className="flex items-center gap-2 ml-11 md:ml-0">
          <Button variant="outline" size="sm" className="h-9 px-4 text-xs font-bold gap-2 rounded-xl">
            <Download className="h-3.5 w-3.5" />
            Export Logs
          </Button>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-xl">
            <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <AuditTrailFilters 
        filters={filters}
        updateFilter={updateFilter}
        clearFilters={clearFilters}
      />

      {/* List Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            History Timeline ({total} entries)
          </span>
        </div>
        
        <AuditTrailTable logs={logs} />
      </div>
    </div>
  );
}
