"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, CheckCheck, X, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { CreatePriceChangeBatchDialog } from "./components/CreatePriceChangeBatchDialog";
import { PcrStatusTabs } from "./components/PcrStatusTabs";
import { PcrTypeTabList } from "./components/PcrTypeTabs";
import { UnifiedApprovalsManager } from "./components/UnifiedApprovalsManager";
import { PriceChangeBatchDetailDialog } from "./components/PriceChangeBatchDetailDialog";
import { PriceChangeBatchesTable } from "./components/PriceChangeBatchesTable";
import { RequestFiltersBar } from "./components/RequestFiltersBar";
import RequestsTable from "./components/RequestsTable";
import { ListPriceRequestDetailDialog } from "./components/ListPriceRequestDetailDialog";
import { RejectDialog } from "./components/RejectDialog";
import { ApproveDialog } from "./components/ApproveDialog";
import { BulkListCostActionResultDialog } from "./components/BulkListCostActionResultDialog";
import { BulkListCostApprovePreview } from "./components/BulkListCostApprovePreview";
import { pcrApproveButtonClass, pcrRejectButtonClass } from "./utils/pcrStatusStyles";
import { applyBulkActionResult, type BulkActionOutcome } from "./utils/applyBulkActionResult";

import { useListCostBulkSelection } from "./hooks/useListCostBulkSelection";
import { usePriceChangeBatches } from "./hooks/usePriceChangeBatches";
import { usePCRList } from "./hooks/usePCR";
import { usePCRActions } from "./hooks/usePCRActions";
import { toast } from "sonner";

import { getLookups, SupplierOption } from "./providers/pcrApi";
import { costRequestToUnifiedRow, snapshotFromCostRow } from "./utils/labels";
import type {
    ApprovalTypeFilter,
    CostChangeRequestRow,
    ListQuery,
    PCRStatusFilter,
    PriceChangeRequestRow,
} from "./types";

type SupplierLookupProps = {
    suppliers: SupplierOption[];
    suppliersLoading: boolean;
    suppliersError: string | null;
};

const DEFAULT_SHARED_QUERY: ListQuery = {
    status: "ALL",
    page: 1,
    page_size: 50,
};

export function PriceChangeRequestsModule() {
    const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
    const [suppliersLoading, setSuppliersLoading] = React.useState(true);
    const [suppliersError, setSuppliersError] = React.useState<string | null>(null);
    const [typeTab, setTypeTab] = React.useState<ApprovalTypeFilter>("all");
    const [sharedQuery, setSharedQuery] = React.useState<ListQuery>(DEFAULT_SHARED_QUERY);

    const loadSuppliers = React.useCallback(async () => {
        setSuppliersLoading(true);
        try {
            const res = await getLookups();
            setSuppliers(res.suppliers);
            setSuppliersError(null);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to load suppliers";
            setSuppliers([]);
            setSuppliersError(message);
            toast.error(message);
        } finally {
            setSuppliersLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadSuppliers();
    }, [loadSuppliers]);

    React.useEffect(() => {
        setSharedQuery((q) => ({ ...q, page: 1 }));
    }, [typeTab]);

    const supplierLookupProps: SupplierLookupProps = {
        suppliers,
        suppliersLoading,
        suppliersError,
    };

    return (
        <div className="space-y-3">
            <Card className="rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle>Price Change Approvals</CardTitle>
                        <div className="text-sm text-muted-foreground">
                            Approve or reject price updates.
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {suppliersError ? (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Suppliers could not be loaded</AlertTitle>
                            <AlertDescription className="space-y-3">
                                <p>{suppliersError}</p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void loadSuppliers()}
                                    disabled={suppliersLoading}
                                >
                                    {suppliersLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Retry
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <Tabs
                        value={typeTab}
                        onValueChange={(value) => setTypeTab(value as ApprovalTypeFilter)}
                    >
                        <PcrTypeTabList />

                        <TabsContent value="all">
                            <UnifiedApprovalsManager
                                {...supplierLookupProps}
                                query={sharedQuery}
                                setQuery={setSharedQuery}
                            />
                        </TabsContent>

                        <TabsContent value="price">
                            <PriceBatchManager
                                {...supplierLookupProps}
                                query={sharedQuery}
                                setQuery={setSharedQuery}
                            />
                        </TabsContent>

                        <TabsContent value="cost">
                            <ItemRequestManager
                                {...supplierLookupProps}
                                query={sharedQuery}
                                setQuery={setSharedQuery}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

type ManagerQueryProps = {
    query: ListQuery;
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>;
};

function PriceBatchManager({
    suppliers,
    suppliersLoading,
    suppliersError,
    query,
    setQuery,
}: SupplierLookupProps & ManagerQueryProps) {
    const batches = usePriceChangeBatches(query, setQuery);
    const statusTab: PCRStatusFilter = batches.query.status || "ALL";

    const [creatingBatch, setCreatingBatch] = React.useState(false);
    const [rejectingId, setRejectingId] = React.useState<number | null>(null);
    const [viewingId, setViewingId] = React.useState<number | null>(null);
    const [confirmingApproveId, setConfirmingApproveId] = React.useState<number | null>(null);

    const confirmingBatch = React.useMemo(
        () => batches.rows.find(r => Number(r.header_id ?? r.id) === confirmingApproveId && r.status === "PENDING"),
        [batches.rows, confirmingApproveId]
    );

    const rejectingBatch = React.useMemo(
        () => batches.rows.find(r => Number(r.header_id ?? r.id) === rejectingId && r.status === "PENDING"),
        [batches.rows, rejectingId]
    );

    const handleConfirmApprove = React.useCallback(async () => {
        if (confirmingApproveId == null) return;
        await batches.approve(confirmingApproveId);
        setViewingId(null);
        setConfirmingApproveId(null);
    }, [confirmingApproveId, batches]);

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <PcrStatusTabs
                    value={statusTab as string}
                    onValueChange={(status) => {
                        batches.setQuery((q) => ({ ...q, status, page: 1 }));
                    }}
                />

                <Button type="button" onClick={() => setCreatingBatch(true)} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    New Batch
                </Button>
            </div>

            <div className="space-y-3">
                <RequestFiltersBar
                    query={batches.query}
                    setQuery={batches.setQuery}
                    suppliers={suppliers}
                    suppliersLoading={suppliersLoading}
                    suppliersError={suppliersError}
                    loading={batches.loading}
                    total={batches.total}
                    totalLabel="batches"
                    searchLabel="Search batches"
                    searchPlaceholder="PCB-123, reference, or remarks"
                    searchHelper="Find a batch by PCB- number, reference, or remarks."
                    filterContext="price"
                    onRefresh={batches.refresh}
                />

                {batches.error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Price change batch storage is not available</AlertTitle>
                        <AlertDescription>{batches.error}</AlertDescription>
                    </Alert>
                ) : null}

                <PriceChangeBatchesTable
                    rows={batches.rows}
                    loading={batches.loading}
                    acting={batches.acting}
                    meta={{ total_count: batches.total }}
                    page={Number(batches.query.page ?? 1)}
                    pageSize={Number(batches.query.page_size ?? 50)}
                    onPageChange={(page) =>
                        batches.setQuery((q) => ({
                            ...q,
                            page,
                        }))
                    }
                    onPageSizeChange={(page_size) =>
                        batches.setQuery((q) => ({
                            ...q,
                            page_size,
                            page: 1,
                        }))
                    }
                    onOpen={(id) => setViewingId(id)}
                    onApprove={(id) => setConfirmingApproveId(id)}
                    onReject={(id) => setRejectingId(id)}
                />
            </div>

            <PriceChangeBatchDetailDialog
                batchId={viewingId}
                open={viewingId != null}
                acting={batches.acting}
                onOpenChange={(open) => {
                    if (!open) setViewingId(null);
                }}
                onApprove={(id) => setConfirmingApproveId(id)}
                onReject={(id) => setRejectingId(id)}
            />

            <CreatePriceChangeBatchDialog
                open={creatingBatch}
                onOpenChange={setCreatingBatch}
                suppliers={suppliers}
                onCreated={batches.refresh}
            />

            <RejectDialog
                open={rejectingId != null}
                onOpenChange={(v) => !v && setRejectingId(null)}
                loading={batches.acting}
                title="Reject Batch"
                onConfirm={(reason) => {
                    if (!rejectingId) return;
                    void batches.reject(rejectingId, reason);
                    setRejectingId(null);
                }}
            >
                {rejectingBatch && (
                    <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1 mb-2">
                        <div className="font-semibold">PCB-{rejectingBatch.header_id ?? rejectingBatch.id}</div>
                        <div className="text-muted-foreground">Supplier: {rejectingBatch.supplier_name || "-"}</div>
                        <div className="text-muted-foreground">Lines: {rejectingBatch.line_count ?? 0} item(s)</div>
                        {rejectingBatch.reference_no && (
                            <div className="text-muted-foreground">Ref: {rejectingBatch.reference_no}</div>
                        )}
                    </div>
                )}
            </RejectDialog>

            <ApproveDialog
                open={confirmingApproveId != null}
                onOpenChange={(v) => !v && setConfirmingApproveId(null)}
                loading={batches.acting}
                onConfirm={() => void handleConfirmApprove()}
                title="Confirm Batch Approval"
                description="Are you sure you want to approve the following batch?"
            >
                {confirmingBatch && (
                    <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
                        <div className="font-semibold">PCB-{confirmingBatch.header_id ?? confirmingBatch.id}</div>
                        <div className="text-muted-foreground">Supplier: {confirmingBatch.supplier_name || "-"}</div>
                        <div className="text-muted-foreground">Lines: {confirmingBatch.line_count ?? 0} item(s)</div>
                        {confirmingBatch.reference_no && (
                            <div className="text-muted-foreground">Ref: {confirmingBatch.reference_no}</div>
                        )}
                    </div>
                )}
            </ApproveDialog>
        </div>
    );
}

function ItemRequestManager({
    suppliers,
    suppliersLoading,
    suppliersError,
    query,
    setQuery,
}: SupplierLookupProps & ManagerQueryProps) {
    const inbox = usePCRList(query, setQuery, { requestType: "cost" });

    const statusTab: PCRStatusFilter = inbox.query.status || "ALL";

    const [viewingRequestId, setViewingRequestId] = React.useState<number | null>(null);
    const [rejectingId, setRejectingId] = React.useState<number | null>(null);
    const [rejectingBulk, setRejectingBulk] = React.useState<boolean>(false);
    const [confirmingApprove, setConfirmingApprove] = React.useState<{
        type: 'single' | 'batch';
        id?: number;
    } | null>(null);
    const [bulkActionOutcome, setBulkActionOutcome] = React.useState<BulkActionOutcome | null>(null);

    const {
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
        (id: number, checked: boolean, row?: CostChangeRequestRow | PriceChangeRequestRow) => {
            toggleSelectRaw(id, checked, row && "proposed_cost" in row ? row : undefined);
        },
        [toggleSelectRaw],
    );

    const viewingRequest = React.useMemo(() => {
        if (viewingRequestId == null) return null;
        const row = inbox.rows.find((r) => Number(r.request_id) === viewingRequestId);
        return row ? costRequestToUnifiedRow(row as CostChangeRequestRow) : null;
    }, [inbox.rows, viewingRequestId]);

    const confirmingRequest = React.useMemo(
        () => confirmingApprove?.type === 'single'
            ? (inbox.rows.find(r => Number(r.request_id) === confirmingApprove.id) ?? null)
            : null,
        [inbox.rows, confirmingApprove]
    );

    const rejectingRequest = React.useMemo(
        () => inbox.rows.find(r => Number(r.request_id) === rejectingId) ?? null,
        [inbox.rows, rejectingId]
    );

    const actions = usePCRActions(() => {
        inbox.refresh();
    });

    const handleApproveSelected = React.useCallback(() => {
        if (selectedIds.length === 0) return;
        setConfirmingApprove({ type: 'batch' });
    }, [selectedIds]);

    const handleConfirmApprove = React.useCallback(async () => {
        if (!confirmingApprove) return;

        if (confirmingApprove.type === 'single' && confirmingApprove.id != null) {
            await actions.approve(confirmingApprove.id);
        } else if (confirmingApprove.type === 'batch' && selectedIds.length > 0) {
            const result = await actions.approveMany(selectedIds);
            applyBulkActionResult(result, selectedSnapshots, removeSelectionIds, setBulkActionOutcome);
        }

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
                    mode={statusTab === "PENDING" || statusTab === "ALL" ? "approver" : "all"}
                    requestType="cost"
                    acting={actions.acting}
                    onReview={(id) => setViewingRequestId(id)}
                    onApprove={(id) => setConfirmingApprove({ type: 'single', id })}
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
                    selectedIds={selectedIds}
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
                onApprove={(id) => {
                    setViewingRequestId(null);
                    setConfirmingApprove({ type: "single", id });
                }}
                onReject={(id) => {
                    setViewingRequestId(null);
                    setRejectingId(id);
                }}
            />

            <RejectDialog
                open={rejectingId != null || rejectingBulk}
                onOpenChange={(v) => {
                    if (!v) {
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
                {rejectingRequest && !rejectingBulk ? (
                    <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1 mb-2">
                        <div className="font-semibold">Request #{rejectingRequest.request_id}</div>
                        {'current_cost' in rejectingRequest && rejectingRequest.current_cost != null && (
                            <div className="text-muted-foreground">
                                Current Cost: ₱{Number(rejectingRequest.current_cost).toLocaleString("en-PH", { minimumFractionDigits: 2 })} → Proposed: ₱{Number(rejectingRequest.proposed_cost).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </div>
                        )}
                        {'proposed_price' in rejectingRequest && (
                            <div className="text-muted-foreground">
                                Proposed Price: ₱{Number(rejectingRequest.proposed_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </div>
                        )}
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
                    confirmingApprove?.type === 'batch'
                        ? "Approve Selected List Cost Requests"
                        : "Confirm Approval"
                }
                description={
                    confirmingApprove?.type === 'batch'
                        ? `You are about to approve ${selectedSnapshots.length} list cost request(s).`
                        : "Are you sure you want to approve this request?"
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
                {confirmingRequest && (
                    <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
                        <div className="font-semibold">Request #{confirmingRequest.request_id}</div>
                        {'current_cost' in confirmingRequest && confirmingRequest.current_cost != null && (
                            <div className="text-muted-foreground">
                                Current Cost: ₱{Number(confirmingRequest.current_cost).toLocaleString("en-PH", { minimumFractionDigits: 2 })} → Proposed: ₱{Number(confirmingRequest.proposed_cost).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </div>
                        )}
                        {'proposed_price' in confirmingRequest && (
                            <div className="text-muted-foreground">
                                Proposed Price: ₱{Number(confirmingRequest.proposed_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>
                )}
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
