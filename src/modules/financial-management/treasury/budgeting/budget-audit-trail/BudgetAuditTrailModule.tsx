"use client";

import { useBudgetAuditTrail } from "./hooks/useBudgetAuditTrail";
import { AuditTrailTable } from "./components/AuditTrailTable";
import { AuditTrailFilters } from "./components/AuditTrailFilters";
import { History } from "lucide-react";

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <History className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
              Budget Audit Trail
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              Track all modifications, approvals, and transaction history for department budgets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Action buttons removed as per user request to keep it data-centric */}
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
            {loading ? "Loading History..." : `History Timeline (${total} entries)`}
          </span>
        </div>
        
        <AuditTrailTable logs={logs} />
      </div>
    </div>
  );
}
