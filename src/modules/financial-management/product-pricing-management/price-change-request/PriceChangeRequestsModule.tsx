"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, CheckCheck, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { PriceChangeBatchDetailDialog } from "./components/PriceChangeBatchDetailDialog";
import { PriceChangeBatchesTable } from "./components/PriceChangeBatchesTable";
import { RequestFiltersBar } from "./components/RequestFiltersBar";
import RequestsTable from "./components/RequestsTable";
import { RejectDialog } from "./components/RejectDialog";
import { ApproveDialog } from "./components/ApproveDialog";

import { usePriceChangeBatches } from "./hooks/usePriceChangeBatches";
import { usePCRList } from "./hooks/usePCR";
import { usePCRActions } from "./hooks/usePCRActions";
import { getLookups, SupplierOption } from "./providers/pcrApi";
import type { ListQuery, PCRStatus } from "./types";

export function PriceChangeRequestsModule() {
    const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
    React.useEffect(() => {
        getLookups().then(res => setSuppliers(res.suppliers)).catch(() => {});
    }, []);

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
                    <Tabs defaultValue="price">
                        <TabsList className="mb-2">
                            <TabsTrigger value="price">Price Type</TabsTrigger>
                            <TabsTrigger value="cost">List Price</TabsTrigger>
                        </TabsList>

                        <TabsContent value="price">
                            <RequestManager type="price" suppliers={suppliers} />
                        </TabsContent>

                        <TabsContent value="cost">
                            <RequestManager type="cost" suppliers={suppliers} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

function RequestManager({ type, suppliers }: { type: "price" | "cost", suppliers: SupplierOption[] }) {
    if (type === "price") {
        return <PriceBatchManager suppliers={suppliers} />;
    }

    return <ItemRequestManager type={type} suppliers={suppliers} />;
}

function PriceBatchManager({ suppliers }: { suppliers: SupplierOption[] }) {
    const batches = usePriceChangeBatches({ status: "PENDING", page_size: 50, page: 1 });
    const statusTab = batches.query.status || "PENDING";

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
            <div className="flex items-center justify-between gap-2">
                <Tabs value={statusTab as string} onValueChange={(v) => {
                    batches.setQuery((q) => ({ ...q, status: v as PCRStatus, page: 1 }));
                }} className="w-full">
                    <TabsList>
                        <TabsTrigger value="PENDING">Pending</TabsTrigger>
                        <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                        <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="space-y-3">
                <RequestFiltersBar
                    query={batches.query}
                    setQuery={batches.setQuery}
                    suppliers={suppliers}
                    loading={batches.loading}
                    total={batches.total}
                    totalLabel="batches"
                    searchLabel="Search batches"
                    searchPlaceholder="Batch number, reference, or remarks"
                    searchHelper="Find a price change batch by document number, reference, or remarks."
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

function ItemRequestManager({ type, suppliers }: { type: "cost", suppliers: SupplierOption[] }) {
    const inbox = usePCRList({ status: "PENDING", page_size: 50, page: 1, requestType: type });

    const statusTab = inbox.query.status || "PENDING";

    const [rejectingId, setRejectingId] = React.useState<number | null>(null);
    const [rejectingBulk, setRejectingBulk] = React.useState<boolean>(false);
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
    const [confirmingApprove, setConfirmingApprove] = React.useState<{
        type: 'single' | 'batch';
        id?: number;
    } | null>(null);

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
    }, type);

    const pendingInboxIds = React.useMemo(
        () =>
            inbox.rows
                .filter((row) => row.status === "PENDING")
                .map((row) => Number(row.request_id))
                .filter((id) => Number.isFinite(id)),
        [inbox.rows],
    );

    React.useEffect(() => {
        setSelectedIds((prev) => prev.filter((id) => pendingInboxIds.includes(id)));
    }, [pendingInboxIds]);

    const toggleSelect = React.useCallback((id: number, checked: boolean) => {
        setSelectedIds((prev) => {
            if (checked) {
                if (prev.includes(id)) return prev;
                return [...prev, id];
            }
            return prev.filter((value) => value !== id);
        });
    }, []);

    const toggleSelectAllPage = React.useCallback(
        (checked: boolean) => {
            setSelectedIds((prev) => {
                const current = new Set(prev);

                if (checked) {
                    for (const id of pendingInboxIds) {
                        current.add(id);
                    }
                } else {
                    for (const id of pendingInboxIds) {
                        current.delete(id);
                    }
                }

                return Array.from(current);
            });
        },
        [pendingInboxIds],
    );

    const clearSelection = React.useCallback(() => {
        setSelectedIds([]);
    }, []);

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
            if (result.successIds.length > 0) {
                setSelectedIds((prev) => prev.filter((id) => !result.successIds.includes(id)));
            }
        }

        setConfirmingApprove(null);
    }, [confirmingApprove, actions, selectedIds]);

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

        if (result.successIds.length > 0) {
            setSelectedIds((prev) => prev.filter((id) => !result.successIds.includes(id)));
        }
    }, [actions, selectedIds]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <Tabs value={statusTab as string} onValueChange={(v) => {
                    clearSelection();
                    inbox.setQuery((q) => ({ ...q, status: v as PCRStatus, page: 1 }));
                }} className="w-full">
                    <TabsList>
                        <TabsTrigger value="PENDING">Pending</TabsTrigger>
                        <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                        <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="space-y-3">
                <RequestFiltersBar
                    query={inbox.query}
                    setQuery={setInboxQuery}
                    suppliers={suppliers}
                    loading={inbox.loading}
                    total={inbox.total}
                    totalLabel="requests"
                    searchLabel="Search requests"
                    searchPlaceholder="Request number or product"
                    searchHelper="Find list price requests by request number or product."
                    onRefresh={() => {
                        clearSelection();
                        inbox.refresh();
                    }}
                    onReset={clearSelection}
                />

                {statusTab === "PENDING" && (
                    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                            {selectedIds.length > 0 ? (
                                <>
                                    <span className="font-medium text-foreground">{selectedIds.length}</span> request(s) selected
                                </>
                            ) : (
                                "Select pending requests to approve them in one save."
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={clearSelection}
                                disabled={actions.acting || selectedIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear
                            </Button>

                            <Button
                                variant="destructive"
                                onClick={() => setRejectingBulk(true)}
                                disabled={actions.acting || selectedIds.length === 0}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Reject Selected
                            </Button>

                            <Button
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
                    mode={statusTab === "PENDING" ? "approver" : "all"}
                    requestType={type}
                    acting={actions.acting}
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

            <RejectDialog
                open={rejectingId != null || rejectingBulk}
                onOpenChange={(v) => {
                    if (!v) {
                        setRejectingId(null);
                        setRejectingBulk(false);
                    }
                }}
                loading={actions.acting}
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
                {rejectingRequest && (
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
                )}
            </RejectDialog>

            <ApproveDialog
                open={confirmingApprove != null}
                onOpenChange={() => setConfirmingApprove(null)}
                loading={actions.acting}
                onConfirm={() => void handleConfirmApprove()}
                title={
                    confirmingApprove?.type === 'batch'
                        ? "Confirm Batch Approval"
                        : "Confirm Approval"
                }
                description={
                    confirmingApprove?.type === 'batch'
                        ? `Are you sure you want to approve ${selectedIds.length} selected request(s)?`
                        : "Are you sure you want to approve this request?"
                }
            >
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
        </div>
    );
}
