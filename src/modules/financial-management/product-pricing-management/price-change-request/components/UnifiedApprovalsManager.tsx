"use client";

import * as React from "react";
import { AlertCircle, CheckCheck, Loader2, Plus, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { ApproveDialog } from "./ApproveDialog";
import { CreatePriceChangeBatchDialog } from "./CreatePriceChangeBatchDialog";
import { PcrStatusTabs } from "./PcrStatusTabs";
import { PriceChangeBatchDetailDialog } from "./PriceChangeBatchDetailDialog";
import { RejectDialog } from "./RejectDialog";
import { RequestFiltersBar } from "./RequestFiltersBar";
import { UnifiedApprovalsTable } from "./UnifiedApprovalsTable";

import { usePCRActions } from "../hooks/usePCRActions";
import { useUnifiedApprovals } from "../hooks/useUnifiedApprovals";
import type { SupplierOption } from "../providers/pcrApi";
import type { PCRStatusFilter } from "../types";

type Props = {
    suppliers: SupplierOption[];
};

export function UnifiedApprovalsManager({ suppliers }: Props) {
    const feed = useUnifiedApprovals({ status: "ALL", page_size: 50, page: 1 });
    const statusTab: PCRStatusFilter = feed.query.status || "ALL";

    const [creatingBatch, setCreatingBatch] = React.useState(false);
    const [viewingBatchId, setViewingBatchId] = React.useState<number | null>(null);
    const [rejectingBatchId, setRejectingBatchId] = React.useState<number | null>(null);
    const [confirmingBatchId, setConfirmingBatchId] = React.useState<number | null>(null);
    const [rejectingCostId, setRejectingCostId] = React.useState<number | null>(null);
    const [rejectingBulkCost, setRejectingBulkCost] = React.useState(false);
    const [confirmingCostApprove, setConfirmingCostApprove] = React.useState<{
        type: "single" | "batch";
        id?: number;
    } | null>(null);
    const [selectedCostIds, setSelectedCostIds] = React.useState<number[]>([]);

    const costActions = usePCRActions(() => {
        void feed.refresh();
    });

    const pendingCostIdsOnPage = React.useMemo(
        () =>
            feed.rows
                .filter((row) => row.kind === "list_price" && row.status === "PENDING" && row.request_id)
                .map((row) => Number(row.request_id)),
        [feed.rows],
    );

    React.useEffect(() => {
        setSelectedCostIds((prev) => prev.filter((id) => pendingCostIdsOnPage.includes(id)));
    }, [pendingCostIdsOnPage]);

    const rejectingBatch = React.useMemo(
        () => feed.rows.find((row) => row.batch_id === rejectingBatchId && row.kind === "price_batch") ?? null,
        [feed.rows, rejectingBatchId],
    );

    const confirmingBatch = React.useMemo(
        () => feed.rows.find((row) => row.batch_id === confirmingBatchId && row.kind === "price_batch") ?? null,
        [feed.rows, confirmingBatchId],
    );

    const showCostBulkBar = statusTab === "PENDING" || statusTab === "ALL";
    const showCostSelection = showCostBulkBar;

    const clearCostSelection = React.useCallback(() => {
        setSelectedCostIds([]);
    }, []);

    const toggleCostSelect = React.useCallback((requestId: number, checked: boolean) => {
        setSelectedCostIds((prev) => {
            if (checked) {
                if (prev.includes(requestId)) return prev;
                return [...prev, requestId];
            }
            return prev.filter((id) => id !== requestId);
        });
    }, []);

    const toggleSelectAllPendingCost = React.useCallback(
        (checked: boolean) => {
            setSelectedCostIds((prev) => {
                const current = new Set(prev);
                if (checked) {
                    for (const id of pendingCostIdsOnPage) current.add(id);
                } else {
                    for (const id of pendingCostIdsOnPage) current.delete(id);
                }
                return Array.from(current);
            });
        },
        [pendingCostIdsOnPage],
    );

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
            if (result.successIds.length > 0) {
                setSelectedCostIds((prev) => prev.filter((id) => !result.successIds.includes(id)));
            }
        }

        setConfirmingCostApprove(null);
    }, [confirmingCostApprove, costActions, selectedCostIds]);

    const handleRejectSelectedCost = React.useCallback(
        async (reason: string) => {
            if (selectedCostIds.length === 0) return;
            const result = await costActions.rejectMany(selectedCostIds, reason);
            if (result.successIds.length > 0) {
                setSelectedCostIds((prev) => prev.filter((id) => !result.successIds.includes(id)));
            }
        },
        [costActions, selectedCostIds],
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
                    loading={feed.loading}
                    total={feed.total}
                    totalLabel="records"
                    searchLabel="Search records"
                    searchPlaceholder="Batch number, product, reference, or remarks"
                    searchHelper="Search across price batches and list price requests."
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
                                <>
                                    <span className="font-medium text-foreground">{selectedCostIds.length}</span> list
                                    price request(s) selected
                                </>
                            ) : (
                                "Select pending list price requests to approve or reject in bulk. Price batches use row actions."
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={clearCostSelection}
                                disabled={acting || selectedCostIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear
                            </Button>

                            <Button
                                variant="destructive"
                                onClick={() => setRejectingBulkCost(true)}
                                disabled={acting || selectedCostIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Reject Selected
                            </Button>

                            <Button
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
            />

            <ApproveDialog
                open={confirmingCostApprove != null}
                onOpenChange={() => setConfirmingCostApprove(null)}
                loading={acting}
                onConfirm={() => void handleConfirmCostApprove()}
                title={
                    confirmingCostApprove?.type === "batch"
                        ? "Confirm Batch Approval"
                        : "Confirm Approval"
                }
                description={
                    confirmingCostApprove?.type === "batch"
                        ? `Are you sure you want to approve ${selectedCostIds.length} selected list price request(s)?`
                        : "Are you sure you want to approve this list price request?"
                }
            />
        </div>
    );
}
