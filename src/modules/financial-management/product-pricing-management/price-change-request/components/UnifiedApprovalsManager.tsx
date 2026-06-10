"use client";

import * as React from "react";
import { AlertCircle, CheckCheck, Loader2, Plus, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { ApproveDialog } from "./ApproveDialog";
import { BulkListCostActionResultDialog } from "./BulkListCostActionResultDialog";
import { BulkListCostApprovePreview } from "./BulkListCostApprovePreview";
import { CreatePriceChangeBatchDialog } from "./CreatePriceChangeBatchDialog";
import { PcrStatusTabs } from "./PcrStatusTabs";
import { ListPriceRequestDetailDialog } from "./ListPriceRequestDetailDialog";
import { PriceChangeBatchDetailDialog } from "./PriceChangeBatchDetailDialog";
import { RejectDialog } from "./RejectDialog";
import { RequestFiltersBar } from "./RequestFiltersBar";
import { UnifiedApprovalsTable } from "./UnifiedApprovalsTable";

import { useListCostBulkSelection } from "../hooks/useListCostBulkSelection";
import { usePCRActions } from "../hooks/usePCRActions";
import { pcrApproveButtonClass, pcrRejectButtonClass } from "../utils/pcrStatusStyles";
import { useUnifiedApprovals } from "../hooks/useUnifiedApprovals";
import type { SupplierOption } from "../providers/pcrApi";
import { applyBulkActionResult, type BulkActionOutcome } from "../utils/applyBulkActionResult";
import { snapshotFromUnifiedRow } from "../utils/labels";
import type { ListQuery, PCRStatusFilter } from "../types";

type Props = {
    suppliers: SupplierOption[];
    suppliersLoading?: boolean;
    suppliersError?: string | null;
    query: ListQuery;
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>;
};

export function UnifiedApprovalsManager({
    suppliers,
    suppliersLoading,
    suppliersError,
    query,
    setQuery,
}: Props) {
    const feed = useUnifiedApprovals(query, setQuery);
    const statusTab: PCRStatusFilter = feed.query.status || "ALL";

    const [creatingBatch, setCreatingBatch] = React.useState(false);
    const [viewingBatchId, setViewingBatchId] = React.useState<number | null>(null);
    const [viewingCostRequestId, setViewingCostRequestId] = React.useState<number | null>(null);
    const [rejectingBatchId, setRejectingBatchId] = React.useState<number | null>(null);
    const [confirmingBatchId, setConfirmingBatchId] = React.useState<number | null>(null);
    const [rejectingCostId, setRejectingCostId] = React.useState<number | null>(null);
    const [rejectingBulkCost, setRejectingBulkCost] = React.useState(false);
    const [confirmingCostApprove, setConfirmingCostApprove] = React.useState<{
        type: "single" | "batch";
        id?: number;
    } | null>(null);
    const [bulkActionOutcome, setBulkActionOutcome] = React.useState<BulkActionOutcome | null>(null);
    const {
        selectedIds: selectedCostIds,
        selectedSnapshots: selectedCostSnapshots,
        offPageSelectedCount,
        toggleSelect: toggleCostSelect,
        toggleSelectAllPage: toggleSelectAllPendingCost,
        clearSelection: clearCostSelection,
        removeSelectionIds: removeCostSelectionIds,
    } = useListCostBulkSelection({
        rows: feed.rows,
        isSelectable: (row) => row.kind === "list_price" && row.status === "PENDING" && Boolean(row.request_id),
        toSnapshot: snapshotFromUnifiedRow,
    });

    const costActions = usePCRActions(() => {
        void feed.refresh();
    });

    const rejectingBatch = React.useMemo(
        () => feed.rows.find((row) => row.batch_id === rejectingBatchId && row.kind === "price_batch") ?? null,
        [feed.rows, rejectingBatchId],
    );

    const confirmingBatch = React.useMemo(
        () => feed.rows.find((row) => row.batch_id === confirmingBatchId && row.kind === "price_batch") ?? null,
        [feed.rows, confirmingBatchId],
    );

    const viewingCostRequest = React.useMemo(
        () =>
            feed.rows.find(
                (row) => row.kind === "list_price" && Number(row.request_id) === viewingCostRequestId,
            ) ?? null,
        [feed.rows, viewingCostRequestId],
    );

    const showCostBulkBar = statusTab === "PENDING" || statusTab === "ALL";
    const showCostSelection = showCostBulkBar;

    const handleConfirmBatchApprove = React.useCallback(async () => {
        if (confirmingBatchId == null) return;
        await feed.approveBatch(confirmingBatchId);
        setViewingBatchId(null);
        setConfirmingBatchId(null);
    }, [confirmingBatchId, feed]);

    const handleConfirmCostApprove = React.useCallback(async () => {
        if (!confirmingCostApprove) return;

        if (confirmingCostApprove.type === "single" && confirmingCostApprove.id != null) {
            await costActions.approve(confirmingCostApprove.id);
        } else if (confirmingCostApprove.type === "batch" && selectedCostIds.length > 0) {
            const result = await costActions.approveMany(selectedCostIds);
            applyBulkActionResult(
                result,
                selectedCostSnapshots,
                removeCostSelectionIds,
                setBulkActionOutcome,
            );
        }

        setConfirmingCostApprove(null);
    }, [confirmingCostApprove, costActions, selectedCostIds, selectedCostSnapshots, removeCostSelectionIds]);

    const handleRejectSelectedCost = React.useCallback(
        async (reason: string) => {
            if (selectedCostIds.length === 0) return;
            const result = await costActions.rejectMany(selectedCostIds, reason);
            applyBulkActionResult(
                result,
                selectedCostSnapshots,
                removeCostSelectionIds,
                setBulkActionOutcome,
            );
        },
        [costActions, selectedCostIds, selectedCostSnapshots, removeCostSelectionIds],
    );

    const acting = feed.acting || costActions.acting;

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <PcrStatusTabs
                    value={statusTab}
                    onValueChange={(status) => {
                        clearCostSelection();
                        feed.setQuery((q) => ({ ...q, status, page: 1 }));
                    }}
                />

                <Button type="button" onClick={() => setCreatingBatch(true)} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    New Batch
                </Button>
            </div>

            <div className="space-y-3">
                <RequestFiltersBar
                    query={feed.query}
                    setQuery={(updater) => {
                        clearCostSelection();
                        feed.setQuery(updater);
                    }}
                    suppliers={suppliers}
                    suppliersLoading={suppliersLoading}
                    suppliersError={suppliersError}
                    loading={feed.loading}
                    total={feed.total}
                    totalLabel="records"
                    searchLabel="Search records"
                    searchPlaceholder="PCB-123, CCR-456, product, reference, or remarks"
                    searchHelper="Search by PCB-/CCR- number, product, reference, or remarks."
                    filterContext="all"
                    onRefresh={() => {
                        clearCostSelection();
                        void feed.refresh();
                    }}
                    onReset={clearCostSelection}
                />

                {feed.error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Approval records could not be loaded</AlertTitle>
                        <AlertDescription>{feed.error}</AlertDescription>
                    </Alert>
                ) : null}

                {showCostBulkBar ? (
                    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                            {selectedCostIds.length > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                    <span>
                                        <span className="font-medium text-foreground">{selectedCostIds.length}</span> list
                                        price request(s) selected
                                    </span>
                                    {offPageSelectedCount > 0 ? (
                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                            Includes {offPageSelectedCount} on other pages.
                                        </span>
                                    ) : null}
                                    {bulkActionOutcome && bulkActionOutcome.result.failedIds.length > 0 ? (
                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                            {bulkActionOutcome.result.failedIds.length} request(s) could not be
                                            processed. Failed rows remain selected.
                                        </span>
                                    ) : null}
                                    <span className="text-xs text-muted-foreground">
                                        Select-all applies to pending rows on this page only.
                                    </span>
                                </div>
                            ) : (
                                "Select pending list price requests to approve or reject in bulk. Price batches use row actions."
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    clearCostSelection();
                                    setBulkActionOutcome(null);
                                }}
                                disabled={acting || selectedCostIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear
                            </Button>

                            <Button
                                variant="outline"
                                className={pcrRejectButtonClass}
                                onClick={() => setRejectingBulkCost(true)}
                                disabled={acting || selectedCostIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Reject Selected
                            </Button>

                            <Button
                                className={pcrApproveButtonClass}
                                onClick={() => setConfirmingCostApprove({ type: "batch" })}
                                disabled={acting || selectedCostIds.length === 0}
                            >
                                {acting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCheck className="mr-2 h-4 w-4" />
                                )}
                                Approve Selected
                            </Button>
                        </div>
                    </div>
                ) : null}

                <UnifiedApprovalsTable
                    rows={feed.rows}
                    loading={feed.loading}
                    acting={acting}
                    meta={{ total_count: feed.total }}
                    page={Number(feed.query.page ?? 1)}
                    pageSize={Number(feed.query.page_size ?? 50)}
                    selectedCostIds={selectedCostIds}
                    showCostSelection={showCostSelection}
                    onPageChange={(page) => feed.setQuery((q) => ({ ...q, page }))}
                    onPageSizeChange={(page_size) => feed.setQuery((q) => ({ ...q, page_size, page: 1 }))}
                    onOpenBatch={setViewingBatchId}
                    onApproveBatch={setConfirmingBatchId}
                    onRejectBatch={setRejectingBatchId}
                    onOpenCost={setViewingCostRequestId}
                    onApproveCost={(id) => setConfirmingCostApprove({ type: "single", id })}
                    onRejectCost={setRejectingCostId}
                    onToggleCostSelect={toggleCostSelect}
                    onToggleSelectAllPendingCost={toggleSelectAllPendingCost}
                />
            </div>

            <PriceChangeBatchDetailDialog
                batchId={viewingBatchId}
                open={viewingBatchId != null}
                acting={acting}
                onOpenChange={(open) => {
                    if (!open) setViewingBatchId(null);
                }}
                onApprove={(id) => setConfirmingBatchId(id)}
                onReject={(id) => setRejectingBatchId(id)}
            />

            <ListPriceRequestDetailDialog
                row={viewingCostRequest}
                open={viewingCostRequestId != null}
                acting={acting}
                onOpenChange={(open) => {
                    if (!open) setViewingCostRequestId(null);
                }}
                onApprove={(id) => {
                    setViewingCostRequestId(null);
                    setConfirmingCostApprove({ type: "single", id });
                }}
                onReject={(id) => {
                    setViewingCostRequestId(null);
                    setRejectingCostId(id);
                }}
            />

            <CreatePriceChangeBatchDialog
                open={creatingBatch}
                onOpenChange={setCreatingBatch}
                suppliers={suppliers}
                onCreated={feed.refresh}
            />

            <RejectDialog
                open={rejectingBatchId != null}
                onOpenChange={(open) => {
                    if (!open) setRejectingBatchId(null);
                }}
                loading={acting}
                title="Reject Batch"
                onConfirm={(reason) => {
                    if (!rejectingBatchId) return;
                    void feed.rejectBatch(rejectingBatchId, reason);
                    setRejectingBatchId(null);
                }}
            >
                {rejectingBatch ? (
                    <div className="mb-2 space-y-1 rounded-md border bg-muted/20 p-3 text-sm">
                        <div className="font-semibold">{rejectingBatch.record_label}</div>
                        <div className="text-muted-foreground">{rejectingBatch.title}</div>
                        {rejectingBatch.line_count != null ? (
                            <div className="text-muted-foreground">Lines: {rejectingBatch.line_count}</div>
                        ) : null}
                    </div>
                ) : null}
            </RejectDialog>

            <ApproveDialog
                open={confirmingBatchId != null}
                onOpenChange={(open) => {
                    if (!open) setConfirmingBatchId(null);
                }}
                loading={acting}
                onConfirm={() => void handleConfirmBatchApprove()}
                title="Confirm Batch Approval"
                description="Are you sure you want to approve the following batch?"
            >
                {confirmingBatch ? (
                    <div className="space-y-1 rounded-md border bg-muted/20 p-3 text-sm">
                        <div className="font-semibold">{confirmingBatch.record_label}</div>
                        <div className="text-muted-foreground">{confirmingBatch.title}</div>
                        {confirmingBatch.line_count != null ? (
                            <div className="text-muted-foreground">Lines: {confirmingBatch.line_count}</div>
                        ) : null}
                    </div>
                ) : null}
            </ApproveDialog>

            <RejectDialog
                open={rejectingCostId != null || rejectingBulkCost}
                onOpenChange={(open) => {
                    if (!open) {
                        setRejectingCostId(null);
                        setRejectingBulkCost(false);
                    }
                }}
                loading={acting}
                contentClassName={rejectingBulkCost ? "sm:max-w-2xl" : undefined}
                title={rejectingBulkCost ? "Reject Selected Requests" : "Reject Request"}
                onConfirm={async (reason) => {
                    if (rejectingCostId != null) {
                        await costActions.reject(rejectingCostId, reason);
                        setRejectingCostId(null);
                    } else if (rejectingBulkCost) {
                        await handleRejectSelectedCost(reason);
                        setRejectingBulkCost(false);
                    }
                }}
            >
                {rejectingBulkCost ? (
                    <div className="mb-2 space-y-2">
                        {offPageSelectedCount > 0 ? (
                            <Alert>
                                <AlertDescription>
                                    This action includes {offPageSelectedCount} selected request(s) from other pages
                                    not visible in the table.
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        <BulkListCostApprovePreview items={selectedCostSnapshots} />
                    </div>
                ) : null}
            </RejectDialog>

            <ApproveDialog
                open={confirmingCostApprove != null}
                onOpenChange={() => setConfirmingCostApprove(null)}
                loading={acting}
                onConfirm={() => void handleConfirmCostApprove()}
                contentClassName={
                    confirmingCostApprove?.type === "batch" ? "sm:max-w-2xl" : undefined
                }
                title={
                    confirmingCostApprove?.type === "batch"
                        ? "Approve Selected List Cost Requests"
                        : "Confirm Approval"
                }
                description={
                    confirmingCostApprove?.type === "batch"
                        ? `You are about to approve ${selectedCostSnapshots.length} list cost request(s).`
                        : "Are you sure you want to approve this list price request?"
                }
            >
                {confirmingCostApprove?.type === "batch" ? (
                    <div className="space-y-2">
                        {offPageSelectedCount > 0 ? (
                            <Alert>
                                <AlertDescription>
                                    This action includes {offPageSelectedCount} selected request(s) from other pages
                                    not visible in the table.
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        <BulkListCostApprovePreview items={selectedCostSnapshots} />
                    </div>
                ) : null}
            </ApproveDialog>

            <BulkListCostActionResultDialog
                open={bulkActionOutcome != null}
                onOpenChange={(open) => {
                    if (!open) setBulkActionOutcome(null);
                }}
                result={bulkActionOutcome?.result ?? null}
                snapshots={bulkActionOutcome?.snapshots ?? []}
            />
        </div>
    );
}
