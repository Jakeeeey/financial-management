// src/modules/financial-management/treasury/bulk-approval/BulkApprovalModule.tsx
"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { ActivityFeed } from "./components/ActivityFeed";
import DraftListTable from "./components/DraftListTable";
import FinalHeaderGroupsTable from "./components/FinalHeaderGroupsTable";
import FinalTopSheetModal from "./components/FinalTopSheetModal";
import VoteModal from "./components/VoteModal";
import { useBulkApproval } from "./hooks/useBulkApproval";
import type { DraftRow, FinalHeaderGroup } from "./type";

type ApprovalTab = "level-approval" | "final-approval";

type TopSheetRedirectState = {
  draftId: number;
  docNo: string;
  divisionName: string;
  encoderName: string;
};

function TopSheetRedirectLoader({ state }: { state: TopSheetRedirectState }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/70 p-4 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border dark:border-slate-800 bg-card/95 p-1 shadow-2xl shadow-primary/10 dark:shadow-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.24),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.16),transparent_38%)]" />
        <div className="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative rounded-[1.75rem] border dark:border-slate-800 bg-background/80 p-6 shadow-inner dark:shadow-none">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border dark:border-slate-800 bg-card shadow-xl shadow-primary/10 dark:shadow-none">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>

          <div className="mt-5 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              Redirecting
            </div>
            <h3 className="mt-3 text-xl font-black tracking-tight text-foreground">
              Opening Final Top Sheet
            </h3>
            <p className="mx-auto mt-1 max-w-xs text-sm font-medium leading-6 text-muted-foreground">
              This draft is already at the final approval level, so it will be reviewed through the matrix.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border dark:border-slate-800 bg-card/80 p-4 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-foreground">{state.docNo}</p>
                <p className="truncate text-xs font-semibold text-muted-foreground">
                  {state.divisionName} · {state.encoderName}
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 rounded-full bg-primary animate-[pulse_1s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [topSheetRedirect, setTopSheetRedirect] = React.useState<TopSheetRedirectState | null>(null);

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

  async function handleTopSheetSubmitted(shouldClose?: boolean) {
    if (shouldClose !== false) {
      setTopSheetOpen(false);
      setSelectedTopSheetGroup(null);
    }
    await refreshAll();
  }

  async function handleDraftAction(draft: DraftRow) {
    const isFinalDivision = approvalContexts.some(
      (context) =>
        context.is_final_approver && context.division_id === draft.division_id
    );

    const shouldOpenTopSheet = Boolean(draft.requires_final_top_sheet) || isFinalDivision;

    if (!shouldOpenTopSheet) {
      void openVoteModal(draft);
      return;
    }

    setTopSheetRedirect({
      draftId: draft.id,
      docNo: draft.doc_no,
      divisionName: draft.division_name ?? `Division #${draft.division_id}`,
      encoderName: draft.encoder_name,
    });
    setActiveTab("final-approval");

    try {
      let groups = finalHeaderGroups;
      if (groups.length === 0) {
        groups = await loadFinalHeaderGroups();
      }

      const matchingGroup =
        groups.find(
          (group) =>
            group.division_id === draft.division_id &&
            Array.isArray(group.draft_ids) &&
            group.draft_ids.includes(draft.id)
        ) ?? groups.find((group) => group.division_id === draft.division_id);

      if (matchingGroup) {
        openTopSheet(matchingGroup);
      }
    } finally {
      setTopSheetRedirect(null);
    }
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
      <div className="flex shrink-0 items-center justify-between rounded-2xl border dark:border-slate-800 bg-card px-5 py-3 shadow-sm dark:shadow-none">
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
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border dark:border-slate-800 bg-muted/20 dark:bg-slate-900/50 px-4 py-2 text-[10px]">
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
        <div className="flex min-h-0 flex-[7] flex-col overflow-hidden rounded-2xl border dark:border-slate-800 bg-card shadow-sm dark:shadow-none">
          <div className="shrink-0 border-b dark:border-slate-800 bg-muted/10 dark:bg-slate-800/50 px-5 py-3">
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

              <div className="flex rounded-full border dark:border-slate-800 bg-background dark:bg-slate-900 p-1 shadow-sm dark:shadow-none">
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

          <div className="flex min-h-0 flex-1 flex-col bg-muted/5 dark:bg-slate-900/50 p-6">
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
                actionLoadingId={topSheetRedirect?.draftId ?? null}
                onAction={handleDraftAction}
              />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-[3] flex-col overflow-hidden rounded-2xl border dark:border-slate-800 bg-card p-6 shadow-sm dark:shadow-none">
          <ActivityFeed logs={logs} loading={logsLoading} />
        </div>
      </div>

      {topSheetRedirect && <TopSheetRedirectLoader state={topSheetRedirect} />}

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
