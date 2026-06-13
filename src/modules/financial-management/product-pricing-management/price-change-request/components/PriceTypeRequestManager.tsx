"use client";

import * as React from "react";
import { AlertCircle, CheckCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { ApproveDialog } from "./ApproveDialog";
import { BulkPriceTypeActionResultDialog } from "./BulkPriceTypeActionResultDialog";
import { BulkPriceTypeApprovePreview } from "./BulkPriceTypeApprovePreview";
import { PcrStatusTabs } from "./PcrStatusTabs";
import { PriceTypeRequestDetailDialog } from "./PriceTypeRequestDetailDialog";
import { RejectDialog } from "./RejectDialog";
import { RequestFiltersBar } from "./RequestFiltersBar";
import RequestsTable from "./RequestsTable";

import { useRequestBulkSelection } from "../hooks/useRequestBulkSelection";
import { usePCRList } from "../hooks/usePCR";
import type { SupplierOption } from "../providers/pcrApi";
import * as pcrApi from "../providers/pcrApi";
import { applyBulkActionResult, type BulkActionOutcome } from "../utils/applyBulkActionResult";
import {
    approveManyBatches,
    rejectManyBatches,
    uniqueBatchCount,
} from "../utils/bulkPriceTypeBatchActions";
import { pcrApproveButtonClass, pcrRejectButtonClass } from "../utils/pcrStatusStyles";
import { pcrBatchMeta, priceRequestToUnifiedRow, snapshotFromPriceRow } from "../utils/labels";
import type {
    CostChangeRequestRow,
    ListQuery,
    PCRStatusFilter,
    PriceChangeRequestRow,
    PriceTypeSelectionSnapshot,
} from "../types";

type Props = {
    suppliers: SupplierOption[];
    suppliersLoading: boolean;
    suppliersError: string | null;
    query: ListQuery;
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>;
};

export function PriceTypeRequestManager({
    suppliers,
    suppliersLoading,
    suppliersError,
    query,
    setQuery,
}: Props) {
    const inbox = usePCRList(query, setQuery, { requestType: "price" });
    const statusTab: PCRStatusFilter = inbox.query.status || "ALL";
    const [viewingRequestId, setViewingRequestId] = React.useState<number | null>(null);
    const [confirmingBatchHeaderId, setConfirmingBatchHeaderId] = React.useState<number | null>(null);
    const [rejectingBatchHeaderId, setRejectingBatchHeaderId] = React.useState<number | null>(null);
    const [confirmingBulkApprove, setConfirmingBulkApprove] = React.useState(false);
    const [rejectingBulk, setRejectingBulk] = React.useState(false);
    const [bulkActionOutcome, setBulkActionOutcome] =
        React.useState<BulkActionOutcome<PriceTypeSelectionSnapshot> | null>(null);
    const [batchActing, setBatchActing] = React.useState(false);

    const isPriceRowSelectable = React.useCallback((row: PriceChangeRequestRow | CostChangeRequestRow) => {
        if (row.status !== "PENDING") return false;
        return Boolean(pcrBatchMeta(row as PriceChangeRequestRow).batch_header_id);
    }, []);

    const {
        selectedKeys,
        selectedIds,
        selectedSnapshots,
        offPageSelectedCount,
        toggleSelect,
        toggleSelectAllPage,
        clearSelection,
        removeSelectionIds,
    } = useRequestBulkSelection({
        rows: inbox.rows,
        isSelectable: isPriceRowSelectable,
        toSnapshot: (row) => snapshotFromPriceRow(row as PriceChangeRequestRow),
    });

    const showBulkBar = statusTab === "PENDING" || statusTab === "ALL";
    const selectedBatchCount = uniqueBatchCount(selectedSnapshots);

    const viewingRequest = React.useMemo(() => {
        if (viewingRequestId == null) return null;
        const row = inbox.rows.find((r) => Number(r.request_id) === viewingRequestId);
        return row ? priceRequestToUnifiedRow(row as PriceChangeRequestRow) : null;
    }, [inbox.rows, viewingRequestId]);

    const approveBatch = React.useCallback(async (headerId: number) => {
        setBatchActing(true);
        try {
            const result = await pcrApi.approvePriceChangeBatch(headerId);
            toast.success(`${result.affected} price change line(s) approved and applied.`);
            await inbox.refresh();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to approve batch";
            toast.error(message);
            throw error;
        } finally {
            setBatchActing(false);
        }
    }, [inbox]);

    const rejectBatch = React.useCallback(async (headerId: number, reason: string) => {
        setBatchActing(true);
        try {
            await pcrApi.rejectPriceChangeBatch(headerId, reason);
            toast.success("Batch rejected.");
            await inbox.refresh();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to reject batch";
            toast.error(message);
            throw error;
        } finally {
            setBatchActing(false);
        }
    }, [inbox]);

    const resolveBatchHeaderId = React.useCallback(
        (requestId: number) => {
            const row = inbox.rows.find((r) => Number(r.request_id) === requestId);
            return row ? pcrBatchMeta(row as PriceChangeRequestRow).batch_header_id : null;
        },
        [inbox.rows],
    );

    const handleConfirmBulkApprove = React.useCallback(async () => {
        if (selectedSnapshots.length === 0) return;
        const result = await approveManyBatches(selectedSnapshots, approveBatch);
        applyBulkActionResult(result, selectedSnapshots, removeSelectionIds, setBulkActionOutcome);
        setConfirmingBulkApprove(false);
    }, [approveBatch, removeSelectionIds, selectedSnapshots]);

    const handleRejectBulk = React.useCallback(
        async (reason: string) => {
            if (selectedSnapshots.length === 0) return;
            const result = await rejectManyBatches(selectedSnapshots, reason, rejectBatch);
            applyBulkActionResult(result, selectedSnapshots, removeSelectionIds, setBulkActionOutcome);
        },
        [rejectBatch, removeSelectionIds, selectedSnapshots],
    );

    const rawSetInboxQuery = inbox.setQuery;
    const setInboxQuery = React.useCallback<React.Dispatch<React.SetStateAction<ListQuery>>>(
        (updater) => {
            clearSelection();
            rawSetInboxQuery(updater);
        },
        [clearSelection, rawSetInboxQuery],
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <PcrStatusTabs
                    value={statusTab as string}
                    onValueChange={(status) => {
                        clearSelection();
                        inbox.setQuery((q) => ({ ...q, status, page: 1 }));
                    }}
                    className="w-full"
                />
            </div>

            <div className="space-y-3">
                <RequestFiltersBar
                    query={inbox.query}
                    setQuery={setInboxQuery}
                    suppliers={suppliers}
                    suppliersLoading={suppliersLoading}
                    suppliersError={suppliersError}
                    loading={inbox.loading}
                    total={inbox.total}
                    totalLabel="requests"
                    searchLabel="Search requests"
                    searchPlaceholder="PCR-123 or product"
                    searchHelper="Find price type requests by PCR- number or product."
                    filterContext="price"
                    onRefresh={() => {
                        clearSelection();
                        inbox.refresh();
                    }}
                    onReset={clearSelection}
                />

                {inbox.error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Price type requests could not be loaded</AlertTitle>
                        <AlertDescription>{inbox.error}</AlertDescription>
                    </Alert>
                ) : null}

                {showBulkBar ? (
                    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                            {selectedIds.length > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                    <span>
                                        <span className="font-medium text-foreground">{selectedIds.length}</span>{" "}
                                        request(s) selected
                                        {selectedBatchCount > 0 ? (
                                            <span> across {selectedBatchCount} batch(es)</span>
                                        ) : null}
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
                                        Select-all applies to pending rows on this page only. Each batch is approved or
                                        rejected in full.
                                    </span>
                                </div>
                            ) : (
                                "Select pending price type requests to approve or reject in bulk."
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    clearSelection();
                                    setBulkActionOutcome(null);
                                }}
                                disabled={(inbox.loading || batchActing) || selectedIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear
                            </Button>

                            <Button
                                variant="outline"
                                className={pcrRejectButtonClass}
                                onClick={() => setRejectingBulk(true)}
                                disabled={(inbox.loading || batchActing) || selectedIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Reject Selected
                            </Button>

                            <Button
                                className={pcrApproveButtonClass}
                                onClick={() => setConfirmingBulkApprove(true)}
                                disabled={(inbox.loading || batchActing) || selectedIds.length === 0}
                            >
                                {inbox.loading || batchActing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCheck className="mr-2 h-4 w-4" />
                                )}
                                Approve Selected
                            </Button>
                        </div>
                    </div>
                ) : null}

                <RequestsTable
                    rows={inbox.rows}
                    mode="approver"
                    showSelectionColumn={showBulkBar}
                    requestType="price"
                    loading={inbox.loading}
                    acting={inbox.loading || batchActing}
                    canSelectRow={isPriceRowSelectable}
                    onReview={(id) => setViewingRequestId(id)}
                    onApprove={(id) => {
                        const headerId = resolveBatchHeaderId(id);
                        if (headerId) setConfirmingBatchHeaderId(headerId);
                    }}
                    onReject={(id) => {
                        const headerId = resolveBatchHeaderId(id);
                        if (headerId) setRejectingBatchHeaderId(headerId);
                    }}
                    meta={{ total_count: inbox.total }}
                    page={Number(inbox.query.page ?? 1)}
                    pageSize={Number(inbox.query.page_size ?? 50)}
                    onPageChange={(page) =>
                        inbox.setQuery((q) => ({
                            ...q,
                            page,
                        }))
                    }
                    onPageSizeChange={(page_size) =>
                        inbox.setQuery((q) => ({
                            ...q,
                            page_size,
                            page: 1,
                        }))
                    }
                    footerItemLabel="requests"
                    selectedKeys={selectedKeys}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAllPage={toggleSelectAllPage}
                />
            </div>

            <PriceTypeRequestDetailDialog
                row={viewingRequest}
                open={viewingRequestId != null}
                acting={inbox.loading || batchActing}
                onOpenChange={(open) => {
                    if (!open) setViewingRequestId(null);
                }}
                onApproveBatch={approveBatch}
                onRejectBatch={rejectBatch}
            />

            <ApproveDialog
                open={confirmingBatchHeaderId != null}
                onOpenChange={() => setConfirmingBatchHeaderId(null)}
                loading={inbox.loading || batchActing}
                title="Approve Price Change Batch"
                description="Approve entire price change batch? All pending lines in this batch will be approved and applied."
                onConfirm={async () => {
                    if (confirmingBatchHeaderId == null) return;
                    await approveBatch(confirmingBatchHeaderId);
                    setConfirmingBatchHeaderId(null);
                }}
            />

            <RejectDialog
                open={rejectingBatchHeaderId != null}
                onOpenChange={(open) => {
                    if (!open) setRejectingBatchHeaderId(null);
                }}
                loading={inbox.loading || batchActing}
                title="Reject Batch"
                onConfirm={async (reason) => {
                    if (rejectingBatchHeaderId == null) return;
                    await rejectBatch(rejectingBatchHeaderId, reason);
                    setRejectingBatchHeaderId(null);
                }}
            />

            <ApproveDialog
                open={confirmingBulkApprove}
                onOpenChange={() => setConfirmingBulkApprove(false)}
                loading={inbox.loading || batchActing}
                contentClassName="sm:max-w-2xl"
                title="Approve Selected Price Type Requests"
                description={`You are about to approve ${selectedSnapshots.length} price type request(s) across ${selectedBatchCount} batch(es). Each batch is approved in full.`}
                onConfirm={() => void handleConfirmBulkApprove()}
            >
                <div className="space-y-2">
                    {offPageSelectedCount > 0 ? (
                        <Alert>
                            <AlertDescription>
                                This action includes {offPageSelectedCount} selected request(s) from other pages not
                                visible in the table.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    <BulkPriceTypeApprovePreview items={selectedSnapshots} />
                </div>
            </ApproveDialog>

            <RejectDialog
                open={rejectingBulk}
                onOpenChange={(open) => {
                    if (!open) setRejectingBulk(false);
                }}
                loading={inbox.loading || batchActing}
                contentClassName="sm:max-w-2xl"
                title="Reject Selected Price Type Requests"
                onConfirm={async (reason) => {
                    await handleRejectBulk(reason);
                    setRejectingBulk(false);
                }}
            >
                <div className="mb-2 space-y-2">
                    {offPageSelectedCount > 0 ? (
                        <Alert>
                            <AlertDescription>
                                This action includes {offPageSelectedCount} selected request(s) from other pages not
                                visible in the table.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    <BulkPriceTypeApprovePreview items={selectedSnapshots} />
                </div>
            </RejectDialog>

            <BulkPriceTypeActionResultDialog
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
