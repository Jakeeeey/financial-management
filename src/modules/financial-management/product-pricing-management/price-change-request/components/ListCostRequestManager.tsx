"use client";

import * as React from "react";
import { AlertCircle, CheckCheck, Loader2, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { ApproveDialog } from "./ApproveDialog";
import { BulkListCostActionResultDialog } from "./BulkListCostActionResultDialog";
import { BulkListCostApprovePreview } from "./BulkListCostApprovePreview";
import { ListPriceRequestDetailDialog } from "./ListPriceRequestDetailDialog";
import { PcrStatusTabs } from "./PcrStatusTabs";
import { RejectDialog } from "./RejectDialog";
import { RequestFiltersBar } from "./RequestFiltersBar";
import RequestsTable from "./RequestsTable";

import { useListCostBulkSelection } from "../hooks/useListCostBulkSelection";
import { usePCRList } from "../hooks/usePCR";
import { usePCRActions } from "../hooks/usePCRActions";
import type { SupplierOption } from "../providers/pcrApi";
import { applyBulkActionResult, type BulkActionOutcome } from "../utils/applyBulkActionResult";
import { pcrApproveButtonClass, pcrRejectButtonClass } from "../utils/pcrStatusStyles";
import { costRequestToUnifiedRow, snapshotFromCostRow } from "../utils/labels";
import type {
    CostChangeRequestRow,
    ListQuery,
    PCRStatusFilter,
    PriceChangeRequestRow,
} from "../types";

type Props = {
    suppliers: SupplierOption[];
    suppliersLoading: boolean;
    suppliersError: string | null;
    query: ListQuery;
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>;
    onUnauthorized?: () => void;
};

export function ListCostRequestManager({
    suppliers,
    suppliersLoading,
    suppliersError,
    query,
    setQuery,
    onUnauthorized,
}: Props) {
    const inbox = usePCRList(query, setQuery, { requestType: "cost" });

    const statusTab: PCRStatusFilter = inbox.query.status || "ALL";

    const [viewingRequestId, setViewingRequestId] = React.useState<number | null>(null);
    const [rejectingId, setRejectingId] = React.useState<number | null>(null);
    const [rejectingBulk, setRejectingBulk] = React.useState<boolean>(false);
    const [confirmingApprove, setConfirmingApprove] = React.useState<
        { type: "single"; id: number } | { type: "batch" } | null
    >(null);
    const [bulkActionOutcome, setBulkActionOutcome] = React.useState<BulkActionOutcome | null>(null);

    const {
        selectedKeys,
        selectedIds,
        selectedSnapshots,
        offPageSelectedCount,
        toggleSelect: toggleSelectRaw,
        toggleSelectAllPage,
        clearSelection,
        removeSelectionIds,
    } = useListCostBulkSelection({
        rows: inbox.rows,
        isSelectable: (row) => row.status === "PENDING",
        toSnapshot: (row) => snapshotFromCostRow(row as CostChangeRequestRow),
    });

    const toggleSelect = React.useCallback(
        (key: string, checked: boolean, row?: CostChangeRequestRow | PriceChangeRequestRow) => {
            toggleSelectRaw(key, checked, row && "proposed_cost" in row ? row : undefined);
        },
        [toggleSelectRaw],
    );

    const viewingRequest = React.useMemo(() => {
        if (viewingRequestId == null) return null;
        const row = inbox.rows.find((r) => Number(r.request_id) === viewingRequestId);
        return row ? costRequestToUnifiedRow(row as CostChangeRequestRow) : null;
    }, [inbox.rows, viewingRequestId]);

    const actions = usePCRActions(() => {
        inbox.refresh();
    }, onUnauthorized);

    const handleApproveSelected = React.useCallback(() => {
        if (selectedIds.length === 0) return;
        setConfirmingApprove({ type: "batch" });
    }, [selectedIds]);

    const openRequestReview = React.useCallback((id: number) => {
        setViewingRequestId(id);
    }, []);

    const handleConfirmApprove = React.useCallback(async () => {
        if (!confirmingApprove) return;

        if (confirmingApprove.type === "single") {
            await actions.approve(confirmingApprove.id);
            setConfirmingApprove(null);
            return;
        }

        if (selectedIds.length === 0) return;

        const result = await actions.approveMany(selectedIds);
        applyBulkActionResult(result, selectedSnapshots, removeSelectionIds, setBulkActionOutcome);
        setConfirmingApprove(null);
    }, [confirmingApprove, actions, selectedIds, selectedSnapshots, removeSelectionIds]);

    const rawSetInboxQuery = inbox.setQuery;
    const setInboxQuery = React.useCallback<React.Dispatch<React.SetStateAction<ListQuery>>>(
        (updater) => {
            clearSelection();
            rawSetInboxQuery(updater);
        },
        [clearSelection, rawSetInboxQuery],
    );

    const handleRejectSelected = React.useCallback(async (reason: string) => {
        if (selectedIds.length === 0) return;

        const result = await actions.rejectMany(selectedIds, reason);
        applyBulkActionResult(result, selectedSnapshots, removeSelectionIds, setBulkActionOutcome);
    }, [actions, selectedIds, selectedSnapshots, removeSelectionIds]);

    React.useEffect(() => {
        if (inbox.unauthorized) onUnauthorized?.();
    }, [inbox.unauthorized, onUnauthorized]);

    if (inbox.unauthorized) return null;

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
                    searchPlaceholder="CCR-123 or product"
                    searchHelper="Find list cost requests by CCR- number or product."
                    filterContext="cost"
                    onRefresh={() => {
                        clearSelection();
                        inbox.refresh();
                    }}
                    onReset={clearSelection}
                />

                {inbox.error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>List cost requests could not be loaded</AlertTitle>
                        <AlertDescription>{inbox.error}</AlertDescription>
                    </Alert>
                ) : null}

                {(statusTab === "PENDING" || statusTab === "ALL") && (
                    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                            {selectedIds.length > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                    <span>
                                        <span className="font-medium text-foreground">{selectedIds.length}</span>{" "}
                                        request(s) selected
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
                                "Select pending requests to approve them in one save."
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    clearSelection();
                                    setBulkActionOutcome(null);
                                }}
                                disabled={actions.acting || selectedIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear
                            </Button>

                            <Button
                                variant="outline"
                                className={pcrRejectButtonClass}
                                onClick={() => setRejectingBulk(true)}
                                disabled={actions.acting || selectedIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Reject Selected
                            </Button>

                            <Button
                                className={pcrApproveButtonClass}
                                onClick={handleApproveSelected}
                                disabled={actions.acting || selectedIds.length === 0}
                            >
                                {actions.acting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCheck className="mr-2 h-4 w-4" />
                                )}
                                Approve Selected
                            </Button>
                        </div>
                    </div>
                )}

                <RequestsTable
                    rows={inbox.rows}
                    mode="approver"
                    showSelectionColumn={statusTab === "PENDING" || statusTab === "ALL"}
                    requestType="cost"
                    loading={inbox.loading}
                    hasLoadError={Boolean(inbox.error)}
                    acting={actions.acting}
                    onReview={openRequestReview}
                    onApprove={(id) => setConfirmingApprove({ type: "single", id })}
                    onReject={(id) => setRejectingId(id)}
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

            <ListPriceRequestDetailDialog
                row={viewingRequest}
                open={viewingRequestId != null}
                acting={actions.acting}
                onOpenChange={(open) => {
                    if (!open) setViewingRequestId(null);
                }}
                onApprove={actions.approve}
                onReject={actions.reject}
            />

            <RejectDialog
                open={rejectingId != null || rejectingBulk}
                onOpenChange={(open) => {
                    if (!open) {
                        setRejectingId(null);
                        setRejectingBulk(false);
                    }
                }}
                loading={actions.acting}
                contentClassName={rejectingBulk ? "sm:max-w-2xl" : undefined}
                title={rejectingBulk ? "Reject Selected Requests" : "Reject Request"}
                onConfirm={async (reason) => {
                    if (rejectingId != null) {
                        await actions.reject(rejectingId, reason);
                        setRejectingId(null);
                    } else if (rejectingBulk) {
                        await handleRejectSelected(reason);
                        setRejectingBulk(false);
                    }
                }}
            >
                {rejectingBulk ? (
                    <div className="mb-2 space-y-2">
                        {offPageSelectedCount > 0 ? (
                            <Alert>
                                <AlertDescription>
                                    This action includes {offPageSelectedCount} selected request(s) from other pages
                                    not visible in the table.
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        <BulkListCostApprovePreview items={selectedSnapshots} />
                    </div>
                ) : null}
            </RejectDialog>

            <ApproveDialog
                open={confirmingApprove != null}
                onOpenChange={() => setConfirmingApprove(null)}
                loading={actions.acting}
                onConfirm={() => void handleConfirmApprove()}
                contentClassName={
                    confirmingApprove?.type === "batch" ? "sm:max-w-2xl" : undefined
                }
                title={
                    confirmingApprove?.type === "batch"
                        ? "Approve Selected List Cost Requests"
                        : "Confirm Approval"
                }
                description={
                    confirmingApprove?.type === "batch"
                        ? `You are about to approve ${selectedSnapshots.length} list cost request(s).`
                        : "Are you sure you want to approve this list cost request?"
                }
            >
                {confirmingApprove?.type === "batch" ? (
                    <div className="space-y-2">
                        {offPageSelectedCount > 0 ? (
                            <Alert>
                                <AlertDescription>
                                    This action includes {offPageSelectedCount} selected request(s) from other pages
                                    not visible in the table.
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        <BulkListCostApprovePreview items={selectedSnapshots} />
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
