// src/modules/financial-management/treasury/budgeting/user-expense-limit-approval/UserExpenseLimitApprovalModule.tsx

"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button }   from "@/components/ui/button";
import { usePendingLimits } from "./hooks/useUserExpenseLimitApproval";
import { ApprovalTable } from "./components/ApprovalTable";
import { ReviewProposalModal } from "./components/ReviewProposalModal";
import type { PendingLimitApproval } from "../user-expense-limit/types";

export default function UserExpenseLimitApprovalModule() {
  const { pendingList, loading, error, refetch, showToast } = usePendingLimits();
  const [selectedProposal, setSelectedProposal] = useState<PendingLimitApproval | null>(null);

  if (loading && pendingList.length === 0) return (
    <div className="p-4 md:p-6 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (error && pendingList.length === 0) return (
    <div className="p-8 text-center border border-red-500/20 bg-red-500/5 rounded-lg">
      <p className="text-red-500 font-medium">Error: {error}</p>
      <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-background text-foreground min-h-screen space-y-6 w-full box-border overflow-hidden">
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Expense Limit Approval</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve spending ceiling requests per user
          </p>
        </div>
      </div>

      {/* Pending Table */}
      <ApprovalTable
        pendingList={pendingList}
        loading={loading}
        error={error}
        onReview={setSelectedProposal}
      />

      {/* Review Modal */}
      {selectedProposal && (
        <ReviewProposalModal
          proposal={selectedProposal}
          onClose={() => setSelectedProposal(null)}
          onSuccess={msg => {
            showToast(msg, "success");
            refetch();
          }}
        />
      )}
    </div>
  );
}
