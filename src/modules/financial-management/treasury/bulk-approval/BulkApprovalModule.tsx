// src/modules/financial-management/treasury/bulk-approval/BulkApprovalModule.tsx
"use client";

import * as React from "react";
import {
  ArrowLeft,
  ClipboardList,
  Layers3,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { ActivityFeed } from "./components/ActivityFeed";
import DraftListTable from "./components/DraftListTable";
import FinalHeaderGroupsTable from "./components/FinalHeaderGroupsTable";
import FinalTopSheetModal from "./components/FinalTopSheetModal";
import VoteModal from "./components/VoteModal";
import { useBulkApproval } from "./hooks/useBulkApproval";
import type { FinalHeaderGroup } from "./type";

type ApprovalTab = "level-approval" | "final-approval";

export default function BulkApprovalModule() {
  const {
    drafts,
    totalItems,
    q,
    setQ,
    page,
    setPage,
    pageCount,
    loading,
    myLevel,
    levelsByDivision,
    unauthorized,
    logs,
    logsLoading,
    modalOpen,
    modalLoading,
    draftDetail,
    openVoteModal,
    closeModal,
    onVoteComplete,

    selectedDivisionId,
    setSelectedDivisionId,
    availableDivisions,
    approvalContexts,
    contextsLoading,
    canDoNormalApproval,
    canDoFinalApproval,
    finalHeaderGroups,
    finalHeaderGroupsLoading,
    loadFinalHeaderGroups,
    refreshAll,
  } = useBulkApproval();

  const [activeTab, setActiveTab] = React.useState<ApprovalTab>("level-approval");
  const [selectedTopSheetGroup, setSelectedTopSheetGroup] = React.useState<FinalHeaderGroup | null>(null);
  const [topSheetOpen, setTopSheetOpen] = React.useState(false);

  React.useEffect(() => {
    if (canDoNormalApproval) {
      setActiveTab("level-approval");
      return;
    }

    if (canDoFinalApproval) {
      setActiveTab("final-approval");
    }
  }, [canDoFinalApproval, canDoNormalApproval]);

  function openTopSheet(group: FinalHeaderGroup) {
    setSelectedTopSheetGroup(group);
    setTopSheetOpen(true);
  }

  async function handleTopSheetSubmitted() {
    setTopSheetOpen(false);
    setSelectedTopSheetGroup(null);
    await refreshAll();
  }

  if (unauthorized) {
    return (
      <div className="flex h-[calc(100vh-6rem)] flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="mb-6 rounded-full bg-destructive/10 p-6 ring-4 ring-destructive/5">
          <ShieldAlert className="h-16 w-16 text-destructive" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground">Access Restricted</h1>
        <p className="mt-3 max-w-lg text-lg font-medium text-muted-foreground">
          You are not registered as an authorized approver for disbursement drafts. Only users in the
          Disbursement Approver registry may access this module.
        </p>
        <Button
          className="mt-8 flex items-center gap-2 rounded-full font-bold shadow-lg"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
          variant="default"
          size="lg"
        >
          <ArrowLeft className="h-5 w-5" />
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-4 pb-4">
      <div className="flex shrink-0 items-center justify-between rounded-2xl border bg-card px-5 py-3 shadow-sm">
        <div className="space-y-0.5">
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-foreground">
            <span className="h-6 w-1.5 rounded-full bg-primary" />
            Bulk Disbursement Approval
          </h1>
          <p className="ml-3.5 text-[11px] font-medium text-muted-foreground leading-none">
            {contextsLoading
              ? "Loading approval contexts..."
              : approvalContexts.length > 1
                ? `You have ${approvalContexts.length} approval contexts across divisions.`
                : canDoFinalApproval && !canDoNormalApproval
                  ? "You are reviewing final top sheets for your assigned division."
                  : myLevel > 0
                    ? `You are a Level ${myLevel} approver — cast your vote on pending drafts.`
                    : "Multi-tier consensus approval for disbursement drafts."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canDoFinalApproval && (
            <Badge className="gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20 border-primary/20">
              <ShieldCheck className="h-3 w-3" />
              Final Approver
            </Badge>
          )}
          <Button
            size="sm"
            className="h-8 rounded-full font-bold tracking-wide shadow-md shadow-primary/20 transition-all active:scale-95"
            onClick={() => void refreshAll()}
            disabled={loading || finalHeaderGroupsLoading}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading || finalHeaderGroupsLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {approvalContexts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/20 px-4 py-2 text-[10px]">
          <span className="font-black uppercase tracking-wider text-muted-foreground">Your contexts</span>
          {approvalContexts.map((context) => (
            <Badge
              key={`${context.division_id}-${context.approver_level}-${context.is_final_approver}`}
              variant="secondary"
              className="rounded-full px-2 py-0.5 font-bold"
            >
              {context.division_name ?? `Division #${context.division_id}`} · {context.is_final_approver ? "Final" : `L${context.approver_level}`}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden xl:flex-row">
        <div className="flex min-h-0 flex-[7] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="shrink-0 border-b bg-muted/10 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold">
                  {activeTab === "final-approval" ? "Final Top Sheets" : "Pending Drafts"}
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-primary/10 px-1.5 py-0 text-[9px] font-bold uppercase tracking-widest text-primary"
                  >
                    Live
                  </Badge>
                </h2>
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                  {activeTab === "final-approval"
                    ? "Review grouped header periods in COA by salesman top-sheet format."
                    : "Click “Vote Now” when a draft is at your active tier level."}
                </p>
              </div>

              <div className="flex rounded-full border bg-background p-1 shadow-sm">
                {canDoNormalApproval && (
                  <Button
                    type="button"
                    size="sm"
                    variant={activeTab === "level-approval" ? "default" : "ghost"}
                    className={`rounded-full gap-2 text-xs font-bold transition-all ${activeTab === "level-approval" ? "shadow-md shadow-primary/20" : ""}`}
                    onClick={() => setActiveTab("level-approval")}
                  >
                    <ClipboardList className="h-4 w-4" />
                    My Level Approvals
                    <Badge variant="secondary" className="ml-1 rounded-full text-[9px] h-4 min-w-[16px] flex items-center justify-center p-0 font-black">
                      {totalItems}
                    </Badge>
                  </Button>
                )}

                {canDoFinalApproval && (
                  <Button
                    type="button"
                    size="sm"
                    variant={activeTab === "final-approval" ? "default" : "ghost"}
                    className={`rounded-full gap-2 text-xs font-bold transition-all ${activeTab === "final-approval" ? "shadow-md shadow-primary/20" : ""}`}
                    onClick={() => setActiveTab("final-approval")}
                  >
                    <Layers3 className="h-4 w-4" />
                    Final Top Sheets
                    <Badge variant="secondary" className="ml-1 rounded-full text-[9px] h-4 min-w-[16px] flex items-center justify-center p-0 font-black">
                      {finalHeaderGroups.length}
                    </Badge>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-muted/5 p-6">
            {activeTab === "final-approval" && canDoFinalApproval ? (
              <FinalHeaderGroupsTable
                groups={finalHeaderGroups}
                loading={finalHeaderGroupsLoading}
                onOpenTopSheet={openTopSheet}
                onRefresh={() => void loadFinalHeaderGroups()}
              />
            ) : (
              <DraftListTable
                rows={drafts}
                totalItems={totalItems}
                q={q}
                setQ={setQ}
                page={page}
                setPage={setPage}
                pageCount={pageCount}
                loading={loading}
                myLevel={myLevel}
                levelsByDivision={levelsByDivision}
                selectedDivisionId={selectedDivisionId}
                setSelectedDivisionId={setSelectedDivisionId}
                availableDivisions={availableDivisions}
                onAction={openVoteModal}
              />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-[3] flex-col overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
          <ActivityFeed logs={logs} loading={logsLoading} />
        </div>
      </div>

      <VoteModal
        open={modalOpen}
        loading={modalLoading}
        detail={draftDetail}
        onClose={closeModal}
        onVoteComplete={onVoteComplete}
      />

      <FinalTopSheetModal
        open={topSheetOpen}
        group={selectedTopSheetGroup}
        onOpenChange={setTopSheetOpen}
        onSubmitted={handleTopSheetSubmitted}
      />
    </div>
  );
}
