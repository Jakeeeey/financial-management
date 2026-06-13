"use client";

import * as React from "react";
import { AlertCircle, CheckCheck, Loader2, Plus, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { ApproveDialog } from "./ApproveDialog";
import { BulkListCostActionResultDialog } from "./BulkListCostActionResultDialog";
import { BulkListCostApprovePreview } from "./BulkListCostApprovePreview";
import { BulkPriceTypeActionResultDialog } from "./BulkPriceTypeActionResultDialog";
import { BulkPriceTypeApprovePreview } from "./BulkPriceTypeApprovePreview";
import { CreatePriceChangeBatchDialog } from "./CreatePriceChangeBatchDialog";
import { PcrStatusTabs } from "./PcrStatusTabs";
import { ListPriceRequestDetailDialog } from "./ListPriceRequestDetailDialog";
import { PriceTypeRequestDetailDialog } from "./PriceTypeRequestDetailDialog";
import { RejectDialog } from "./RejectDialog";
import { RequestFiltersBar } from "./RequestFiltersBar";
import RequestsTable from "./RequestsTable";

import { useRequestBulkSelection } from "../hooks/useRequestBulkSelection";
import { usePCRActions } from "../hooks/usePCRActions";
import { pcrApproveButtonClass, pcrRejectButtonClass } from "../utils/pcrStatusStyles";
import { useUnifiedApprovals } from "../hooks/useUnifiedApprovals";
import { isUnauthorizedError } from "../../shared/apiHttp";
import type { SupplierOption } from "../providers/pcrApi";
import { applyBulkActionResult, type BulkActionOutcome } from "../utils/applyBulkActionResult";
import {
    approveManyBatches,
    rejectManyBatches,
    uniqueBatchCount,
} from "../utils/bulkPriceTypeBatchActions";
import { snapshotFromPriceUnifiedRow, snapshotFromUnifiedRow } from "../utils/labels";
import type {
    CostChangeRequestRow,
    ItemUnifiedApprovalRow,
    ListQuery,
    PCRStatusFilter,
    PriceChangeRequestRow,
    PriceTypeSelectionSnapshot,
    PriceTypeUnifiedApprovalRow,
} from "../types";

type Props = {
    suppliers: SupplierOption[];
    suppliersLoading?: boolean;
    suppliersError?: string | null;
    query: ListQuery;
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>;
    onUnauthorized?: () => void;
    active?: boolean;
};

function resolveUnifiedSelectionKey(row: ItemUnifiedApprovalRow): string {
    return row.row_key;
}

export function UnifiedApprovalsManager({
    suppliers,
    suppliersLoading,
    suppliersError,
    query,
    setQuery,
    onUnauthorized,
    active = true,
}: Props) {
    const feed = useUnifiedApprovals(query, setQuery, { enabled: active });
    const statusTab: PCRStatusFilter = feed.query.status || "ALL";

    const [creatingBatch, setCreatingBatch] = React.useState(false);
    const [viewingCostRequestId, setViewingCostRequestId] = React.useState<number | null>(null);
    const [viewingPriceRequestId, setViewingPriceRequestId] = React.useState<number | null>(null);
    const [rejectingCostId, setRejectingCostId] = React.useState<number | null>(null);
    const [rejectingBulkCost, setRejectingBulkCost] = React.useState(false);
    const [rejectingBulkPrice, setRejectingBulkPrice] = React.useState(false);
    const [confirmingCostApprove, setConfirmingCostApprove] = React.useState<
        { type: "single"; id: number } | { type: "batch" } | null
    >(null);
    const [confirmingBulkPriceApprove, setConfirmingBulkPriceApprove] = React.useState(false);
    const [confirmingPriceBatchHeaderId, setConfirmingPriceBatchHeaderId] = React.useState<number | null>(null);
    const [rejectingPriceBatchHeaderId, setRejectingPriceBatchHeaderId] = React.useState<number | null>(null);
    const [bulkCostActionOutcome, setBulkCostActionOutcome] = React.useState<BulkActionOutcome | null>(null);
    const [bulkPriceActionOutcome, setBulkPriceActionOutcome] =
        React.useState<BulkActionOutcome<PriceTypeSelectionSnapshot> | null>(null);

    const {
        selectedKeys: selectedCostKeys,
        selectedIds: selectedCostIds,
        selectedSnapshots: selectedCostSnapshots,
        offPageSelectedCount: offPageSelectedCostCount,
        toggleSelect: toggleCostSelect,
        toggleSelectAllPage: toggleSelectAllPendingCost,
        clearSelection: clearCostSelection,
        removeSelectionIds: removeCostSelectionIds,
    } = useRequestBulkSelection({
        rows: feed.rows,
        isSelectable: (row) => row.kind === "list_price" && row.status === "PENDING" && Boolean(row.request_id),
        toSnapshot: snapshotFromUnifiedRow,
        getRowKey: resolveUnifiedSelectionKey,
    });

    const {
        selectedKeys: selectedPriceKeys,
        selectedIds: selectedPriceIds,
        selectedSnapshots: selectedPriceSnapshots,
        offPageSelectedCount: offPageSelectedPriceCount,
        toggleSelect: togglePriceSelect,
        toggleSelectAllPage: toggleSelectAllPendingPrice,
        clearSelection: clearPriceSelection,
        removeSelectionIds: removePriceSelectionIds,
    } = useRequestBulkSelection({
        rows: feed.rows,
        isSelectable: (row) =>
            row.kind === "price_type" && row.status === "PENDING" && Boolean(row.batch_header_id),
        toSnapshot: (row) => snapshotFromPriceUnifiedRow(row as PriceTypeUnifiedApprovalRow),
        getRowKey: resolveUnifiedSelectionKey,
    });

    const clearAllSelections = React.useCallback(() => {
        clearCostSelection();
        clearPriceSelection();
        setBulkCostActionOutcome(null);
        setBulkPriceActionOutcome(null);
    }, [clearCostSelection, clearPriceSelection]);

    const costActions = usePCRActions(() => {
        void feed.refresh();
    }, onUnauthorized);

    const viewingCostRequest = React.useMemo(
        () =>
            feed.rows.find(
                (row) => row.kind === "list_price" && Number(row.request_id) === viewingCostRequestId,
            ) ?? null,
        [feed.rows, viewingCostRequestId],
    );

    const viewingPriceRequest = React.useMemo(() => {
        if (viewingPriceRequestId == null) return null;
        const row = feed.rows.find(
            (item) => item.kind === "price_type" && Number(item.request_id) === viewingPriceRequestId,
        );
        return row && row.kind === "price_type" ? row : null;
    }, [feed.rows, viewingPriceRequestId]);

    const showBulkBar = statusTab === "PENDING" || statusTab === "ALL";
    const hasCostSelection = selectedCostIds.length > 0;
    const hasPriceSelection = selectedPriceIds.length > 0;
    const isMixedSelection = hasCostSelection && hasPriceSelection;
    const hasAnySelection = hasCostSelection || hasPriceSelection;
    const selectedBatchCount = uniqueBatchCount(selectedPriceSnapshots);
    const mergedSelectedKeys = React.useMemo(
        () => [...selectedCostKeys, ...selectedPriceKeys],
        [selectedCostKeys, selectedPriceKeys],
    );

    const handleConfirmCostApprove = React.useCallback(async () => {
        if (!confirmingCostApprove) return;

        if (confirmingCostApprove.type === "single") {
            await costActions.approve(confirmingCostApprove.id);
            setConfirmingCostApprove(null);
            return;
        }

        if (selectedCostIds.length === 0) return;

        const result = await costActions.approveMany(selectedCostIds);
        applyBulkActionResult(
            result,
            selectedCostSnapshots,
            removeCostSelectionIds,
            setBulkCostActionOutcome,
        );
        setConfirmingCostApprove(null);
    }, [confirmingCostApprove, costActions, selectedCostIds, selectedCostSnapshots, removeCostSelectionIds]);

    const handleConfirmBulkPriceApprove = React.useCallback(async () => {
        if (selectedPriceSnapshots.length === 0) return;
        try {
            const result = await approveManyBatches(selectedPriceSnapshots, feed.approveBatch);
            applyBulkActionResult(
                result,
                selectedPriceSnapshots,
                removePriceSelectionIds,
                setBulkPriceActionOutcome,
            );
        } catch (error: unknown) {
            if (isUnauthorizedError(error)) {
                onUnauthorized?.();
                return;
            }
            throw error;
        }
        setConfirmingBulkPriceApprove(false);
    }, [feed.approveBatch, onUnauthorized, removePriceSelectionIds, selectedPriceSnapshots]);

    const openRequestReview = React.useCallback((id: number) => {
        const row = feed.rows.find((item) => Number(item.request_id) === id);
        if (row && row.kind === "list_price") {
            setViewingCostRequestId(id);
            return;
        }
        setViewingPriceRequestId(id);
    }, [feed.rows]);

    const handleTableApprove = React.useCallback(
        (id: number) => {
            const row = feed.rows.find((item) => Number(item.request_id) === id);
            if (row?.kind === "list_price") {
                setConfirmingCostApprove({ type: "single", id });
                return;
            }
            if (row?.kind === "price_type" && row.batch_header_id) {
                setConfirmingPriceBatchHeaderId(row.batch_header_id);
            }
        },
        [feed.rows],
    );

    const handleTableReject = React.useCallback(
        (id: number) => {
            const row = feed.rows.find((item) => Number(item.request_id) === id);
            if (row?.kind === "list_price") {
                setRejectingCostId(id);
                return;
            }
            if (row?.kind === "price_type" && row.batch_header_id) {
                setRejectingPriceBatchHeaderId(row.batch_header_id);
            }
        },
        [feed.rows],
    );

    const canSelectUnifiedRow = React.useCallback((row: PriceChangeRequestRow | CostChangeRequestRow) => {
        const unified = row as ItemUnifiedApprovalRow;
        if (unified.kind === "list_price") return unified.status === "PENDING";
        if (unified.kind === "price_type") {
            return unified.status === "PENDING" && Boolean(unified.batch_header_id);
        }
        return false;
    }, []);

    const canActOnRow = React.useCallback((row: ItemUnifiedApprovalRow) => {
        if (row.kind === "list_price") return true;
        return row.status === "PENDING" && Boolean(row.batch_header_id);
    }, []);

    const getUnifiedSelectionKey = React.useCallback(
        (row: PriceChangeRequestRow | CostChangeRequestRow) =>
            resolveUnifiedSelectionKey(row as ItemUnifiedApprovalRow),
        [],
    );

    const handleToggleSelect = React.useCallback(
        (key: string, checked: boolean, row?: PriceChangeRequestRow | CostChangeRequestRow) => {
            const unified = row as ItemUnifiedApprovalRow | undefined;
            if (unified?.kind === "price_type") {
                togglePriceSelect(key, checked, unified);
                return;
            }
            if (unified?.kind === "list_price") {
                toggleCostSelect(key, checked, unified);
            }
        },
        [toggleCostSelect, togglePriceSelect],
    );

    const handleToggleSelectAllPage = React.useCallback(
        (checked: boolean) => {
            toggleSelectAllPendingCost(checked);
            toggleSelectAllPendingPrice(checked);
        },
        [toggleSelectAllPendingCost, toggleSelectAllPendingPrice],
    );

    const handleRejectSelectedCost = React.useCallback(
        async (reason: string) => {
            if (selectedCostIds.length === 0) return;
            const result = await costActions.rejectMany(selectedCostIds, reason);
            applyBulkActionResult(
                result,
                selectedCostSnapshots,
                removeCostSelectionIds,
                setBulkCostActionOutcome,
            );
        },
        [costActions, selectedCostIds, selectedCostSnapshots, removeCostSelectionIds],
    );

    const handleRejectSelectedPrice = React.useCallback(
        async (reason: string) => {
            if (selectedPriceSnapshots.length === 0) return;
            try {
                const result = await rejectManyBatches(selectedPriceSnapshots, reason, feed.rejectBatch);
                applyBulkActionResult(
                    result,
                    selectedPriceSnapshots,
                    removePriceSelectionIds,
                    setBulkPriceActionOutcome,
                );
            } catch (error: unknown) {
                if (isUnauthorizedError(error)) {
                    onUnauthorized?.();
                    return;
                }
                throw error;
            }
        },
        [feed.rejectBatch, onUnauthorized, removePriceSelectionIds, selectedPriceSnapshots],
    );

    const handleBulkReject = React.useCallback(() => {
        if (hasPriceSelection) {
            setRejectingBulkPrice(true);
            return;
        }
        setRejectingBulkCost(true);
    }, [hasPriceSelection]);

    const handleBulkApprove = React.useCallback(() => {
        if (hasPriceSelection) {
            setConfirmingBulkPriceApprove(true);
            return;
        }
        setConfirmingCostApprove({ type: "batch" });
    }, [hasPriceSelection]);

    const acting = feed.acting || costActions.acting;

    React.useEffect(() => {
        if (feed.unauthorized) onUnauthorized?.();
    }, [feed.unauthorized, onUnauthorized]);

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <PcrStatusTabs
                    value={statusTab}
                    onValueChange={(status) => {
                        clearAllSelections();
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
                        clearAllSelections();
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
                        clearAllSelections();
                        void feed.refresh();
                    }}
                    onReset={clearAllSelections}
                />

                {feed.error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Approval records could not be loaded</AlertTitle>
                        <AlertDescription className="space-y-3">
                            <p>{feed.error}</p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void feed.refresh()}
                                disabled={feed.loading}
                            >
                                {feed.loading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Retry
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {showBulkBar ? (
                    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                            {hasAnySelection ? (
                                <div className="flex flex-col gap-0.5">
                                    {hasCostSelection ? (
                                        <span>
                                            <span className="font-medium text-foreground">{selectedCostIds.length}</span>{" "}
                                            list cost request(s) selected
                                        </span>
                                    ) : null}
                                    {hasPriceSelection ? (
                                        <span>
                                            <span className="font-medium text-foreground">{selectedPriceIds.length}</span>{" "}
                                            price type request(s) selected
                                            {selectedBatchCount > 0 ? (
                                                <span> across {selectedBatchCount} batch(es)</span>
                                            ) : null}
                                        </span>
                                    ) : null}
                                    {isMixedSelection ? (
                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                            Select only list cost or only price type requests to bulk approve/reject.
                                        </span>
                                    ) : null}
                                    {(offPageSelectedCostCount > 0 || offPageSelectedPriceCount > 0) ? (
                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                            Includes {offPageSelectedCostCount + offPageSelectedPriceCount} on other pages.
                                        </span>
                                    ) : null}
                                    {bulkCostActionOutcome && bulkCostActionOutcome.result.failedIds.length > 0 ? (
                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                            {bulkCostActionOutcome.result.failedIds.length} list cost request(s) could not
                                            be processed.
                                        </span>
                                    ) : null}
                                    {bulkPriceActionOutcome && bulkPriceActionOutcome.result.failedIds.length > 0 ? (
                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                            {bulkPriceActionOutcome.result.failedIds.length} price type request(s) could
                                            not be processed.
                                        </span>
                                    ) : null}
                                    <span className="text-xs text-muted-foreground">
                                        Select-all applies to pending rows on this page only.
                                    </span>
                                </div>
                            ) : (
                                "Select pending list cost or price type requests to approve or reject in bulk."
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={clearAllSelections}
                                disabled={acting || !hasAnySelection}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear
                            </Button>

                            <Button
                                className={pcrApproveButtonClass}
                                onClick={handleBulkApprove}
                                disabled={acting || !hasAnySelection || isMixedSelection}
                            >
                                {acting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCheck className="mr-2 h-4 w-4" />
                                )}
                                Approve Selected
                            </Button>

                            <Button
                                variant="outline"
                                className={pcrRejectButtonClass}
                                onClick={handleBulkReject}
                                disabled={acting || !hasAnySelection || isMixedSelection}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Reject Selected
                            </Button>
                        </div>
                    </div>
                ) : null}

                <RequestsTable
                    rows={feed.rows}
                    mode="approver"
                    showSelectionColumn={showBulkBar}
                    requestType="mixed"
                    loading={feed.loading}
                    hasLoadError={Boolean(feed.error)}
                    acting={acting}
                    meta={{ total_count: feed.total }}
                    page={Number(feed.query.page ?? 1)}
                    pageSize={Number(feed.query.page_size ?? 50)}
                    onPageChange={(page) => feed.setQuery((q) => ({ ...q, page }))}
                    onPageSizeChange={(page_size) => feed.setQuery((q) => ({ ...q, page_size, page: 1 }))}
                    footerItemLabel="records"
                    selectedKeys={mergedSelectedKeys}
                    getSelectionKey={getUnifiedSelectionKey}
                    onReview={openRequestReview}
                    onReject={handleTableReject}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAllPage={handleToggleSelectAllPage}
                    onApprove={handleTableApprove}
                    canSelectRow={canSelectUnifiedRow}
                    canReviewRow={() => true}
                    canApproveRow={(row) => canActOnRow(row as ItemUnifiedApprovalRow)}
                    canRejectRow={(row) => canActOnRow(row as ItemUnifiedApprovalRow)}
                />
            </div>

            <ListPriceRequestDetailDialog
                row={viewingCostRequest}
                open={viewingCostRequestId != null}
                acting={acting}
                onOpenChange={(open) => {
                    if (!open) setViewingCostRequestId(null);
                }}
                onApprove={costActions.approve}
                onReject={costActions.reject}
            />

            <PriceTypeRequestDetailDialog
                row={viewingPriceRequest}
                open={viewingPriceRequestId != null}
                acting={acting}
                onOpenChange={(open) => {
                    if (!open) setViewingPriceRequestId(null);
                }}
                onApproveBatch={feed.approveBatch}
                onRejectBatch={feed.rejectBatch}
            />

            <CreatePriceChangeBatchDialog
                open={creatingBatch}
                onOpenChange={setCreatingBatch}
                suppliers={suppliers}
                onCreated={feed.refresh}
            />

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
                        {offPageSelectedCostCount > 0 ? (
                            <Alert>
                                <AlertDescription>
                                    This action includes {offPageSelectedCostCount} selected request(s) from other pages
                                    not visible in the table.
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        <BulkListCostApprovePreview items={selectedCostSnapshots} />
                    </div>
                ) : null}
            </RejectDialog>

            <RejectDialog
                open={rejectingBulkPrice}
                onOpenChange={(open) => {
                    if (!open) setRejectingBulkPrice(false);
                }}
                loading={acting}
                contentClassName="sm:max-w-2xl"
                title="Reject Selected Price Type Requests"
                onConfirm={async (reason) => {
                    await handleRejectSelectedPrice(reason);
                    setRejectingBulkPrice(false);
                }}
            >
                <div className="mb-2 space-y-2">
                    {offPageSelectedPriceCount > 0 ? (
                        <Alert>
                            <AlertDescription>
                                This action includes {offPageSelectedPriceCount} selected request(s) from other pages
                                not visible in the table.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    <BulkPriceTypeApprovePreview items={selectedPriceSnapshots} />
                </div>
            </RejectDialog>

            <RejectDialog
                open={rejectingPriceBatchHeaderId != null}
                onOpenChange={(open) => {
                    if (!open) setRejectingPriceBatchHeaderId(null);
                }}
                loading={acting}
                title="Reject Batch"
                onConfirm={async (reason) => {
                    if (rejectingPriceBatchHeaderId == null) return;
                    await feed.rejectBatch(rejectingPriceBatchHeaderId, reason);
                    setRejectingPriceBatchHeaderId(null);
                }}
            />

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
                        : "Are you sure you want to approve this list cost request?"
                }
            >
                {confirmingCostApprove?.type === "batch" ? (
                    <div className="space-y-2">
                        {offPageSelectedCostCount > 0 ? (
                            <Alert>
                                <AlertDescription>
                                    This action includes {offPageSelectedCostCount} selected request(s) from other pages
                                    not visible in the table.
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        <BulkListCostApprovePreview items={selectedCostSnapshots} />
                    </div>
                ) : null}
            </ApproveDialog>

            <ApproveDialog
                open={confirmingBulkPriceApprove}
                onOpenChange={() => setConfirmingBulkPriceApprove(false)}
                loading={acting}
                contentClassName="sm:max-w-2xl"
                title="Approve Selected Price Type Requests"
                description={`You are about to approve ${selectedPriceSnapshots.length} price type request(s) across ${selectedBatchCount} batch(es). Each batch is approved in full.`}
                onConfirm={() => void handleConfirmBulkPriceApprove()}
            >
                <div className="space-y-2">
                    {offPageSelectedPriceCount > 0 ? (
                        <Alert>
                            <AlertDescription>
                                This action includes {offPageSelectedPriceCount} selected request(s) from other pages
                                not visible in the table.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    <BulkPriceTypeApprovePreview items={selectedPriceSnapshots} />
                </div>
            </ApproveDialog>

            <ApproveDialog
                open={confirmingPriceBatchHeaderId != null}
                onOpenChange={() => setConfirmingPriceBatchHeaderId(null)}
                loading={acting}
                title="Approve Price Change Batch"
                description="Approve entire price change batch? All pending lines in this batch will be approved and applied."
                onConfirm={async () => {
                    if (confirmingPriceBatchHeaderId == null) return;
                    await feed.approveBatch(confirmingPriceBatchHeaderId);
                    setConfirmingPriceBatchHeaderId(null);
                }}
            />

            <BulkListCostActionResultDialog
                open={bulkCostActionOutcome != null}
                onOpenChange={(open) => {
                    if (!open) setBulkCostActionOutcome(null);
                }}
                result={bulkCostActionOutcome?.result ?? null}
                snapshots={bulkCostActionOutcome?.snapshots ?? []}
            />

            <BulkPriceTypeActionResultDialog
                open={bulkPriceActionOutcome != null}
                onOpenChange={(open) => {
                    if (!open) setBulkPriceActionOutcome(null);
                }}
                result={bulkPriceActionOutcome?.result ?? null}
                snapshots={bulkPriceActionOutcome?.snapshots ?? []}
            />
        </div>
    );
}
