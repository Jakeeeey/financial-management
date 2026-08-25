// src/modules/user-expense-limit/UserExpenseLimitModule.tsx

"use client";

import { useState } from "react";
import { Button }   from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus }     from "lucide-react";
import { useUserExpenseLimits, useDepartments } from "./hooks/useUserExpenseLimit";
import { LimitTable }     from "./components/LimitTable";
import { LimitFilters }   from "./components/LimitFilters";
import { AddLimitModal }  from "./components/AddLimitModal";
import { EditLimitModal } from "./components/EditLimitModal";
import type { UserExpenseLimit } from "./types";

export default function UserExpenseLimitModule() {
  const { limits, loading, error, showToast, refetch, filters, updateFilter, clearFilters, hasFilters } = useUserExpenseLimits();
  const { departments } = useDepartments();
  const [showAdd,   setShowAdd]   = useState(false);
  const [editLimit, setEditLimit] = useState<UserExpenseLimit | null>(null);

  if (loading && limits.length === 0) return (
    <div className="p-4 md:p-6 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (error && limits.length === 0) return (
    <div className="p-8 text-center border border-red-500/20 bg-red-500/5 rounded-lg">
      <p className="text-red-500 font-medium">Error: {error}</p>
      <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-background text-foreground min-h-screen space-y-6 w-full box-border overflow-hidden">

      {/* Header + Add button inline */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Expense Limit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage spending ceilings per user
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="h-9 px-3 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Limit
        </Button>
      </div>

      {/* Filters */}
      <LimitFilters
        filters={filters}
        departments={departments}
        hasFilters={hasFilters}
        onChange={updateFilter}
        onClear={clearFilters}
      />

      {/* Table */}
      <LimitTable
        limits={limits}
        loading={loading}
        error={error}
        onEdit={setEditLimit}
      />

      {/* Add Modal */}
      {showAdd && (
        <AddLimitModal
          onClose={() => setShowAdd(false)}
          onSuccess={msg => { showToast(msg, "success"); refetch(); }}
        />
      )}

      {/* Edit Modal */}
      {editLimit && (
        <EditLimitModal
          limit={editLimit}
          onClose={() => setEditLimit(null)}
          onSuccess={msg => { showToast(msg, "success"); refetch(); }}
        />
      )}
    </div>
  );
}