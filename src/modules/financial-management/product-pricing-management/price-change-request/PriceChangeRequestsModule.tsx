"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Plus, CheckCheck, X } from "lucide-react";

import RequestsTable from "./components/RequestsTable";
import { RejectDialog } from "./components/RejectDialog";
import CreateRequestDialog from "./components/CreateRequestsDialog";

import { usePCRList } from "./hooks/usePCR";
import { usePCRActions } from "./hooks/usePCRActions";

export function PriceChangeRequestsModule() {
    const inbox = usePCRList({ status: "PENDING", page_size: 50, page: 1 });
    const mine = usePCRList({ status: "", page_size: 50, page: 1 });

    const [rejectingId, setRejectingId] = React.useState<number | null>(null);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);

    const actions = usePCRActions(() => {
        inbox.refresh();
        mine.refresh();
    });

    const priceTypes = React.useMemo(
        () => [
            { price_type_id: 16, price_type_name: "A" },
            { price_type_id: 17, price_type_name: "B" },
            { price_type_id: 18, price_type_name: "C" },
            { price_type_id: 19, price_type_name: "D" },
            { price_type_id: 20, price_type_name: "E" },
        ],
        [],
    );

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

    const handleApproveSelected = React.useCallback(async () => {
        if (selectedIds.length === 0) return;

        const result = await actions.approveMany(selectedIds);

        if (result.successIds.length > 0) {
            setSelectedIds((prev) => prev.filter((id) => !result.successIds.includes(id)));
        }
    }, [actions, selectedIds]);

    return (
        <div className="space-y-3">
            <Card className="rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle>Price Change Requests</CardTitle>
                        <div className="text-sm text-muted-foreground">
                            Create requests and approve/reject to apply price updates.
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Request
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => {
                                clearSelection();
                                inbox.refresh();
                                mine.refresh();
                            }}
                            disabled={inbox.loading || mine.loading}
                        >
                            {inbox.loading || mine.loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Refresh
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-3">
                    <Tabs defaultValue="inbox">
                        <TabsList>
                            <TabsTrigger value="inbox">Approvals Inbox</TabsTrigger>
                            <TabsTrigger value="mine">My Requests</TabsTrigger>
                        </TabsList>

                        <TabsContent value="inbox" className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <Input
                                    placeholder="Search request # / product name / product code..."
                                    value={inbox.query.q ?? ""}
                                    onChange={(e) =>
                                        inbox.setQuery((q) => ({
                                            ...q,
                                            q: e.target.value,
                                            page: 1,
                                        }))
                                    }
                                    className="sm:max-w-md"
                                />
                                <div className="text-sm text-muted-foreground">Total: {inbox.total.toLocaleString()}</div>
                            </div>

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

                            <RequestsTable
                                rows={inbox.rows}
                                mode="approver"
                                acting={actions.acting}
                                onApprove={(id) => actions.approve(id)}
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
                        </TabsContent>

                        <TabsContent value="mine" className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <Input
                                    placeholder="Search request # / product..."
                                    value={mine.query.q ?? ""}
                                    onChange={(e) =>
                                        mine.setQuery((q) => ({
                                            ...q,
                                            q: e.target.value,
                                            page: 1,
                                        }))
                                    }
                                    className="sm:max-w-md"
                                />
                                <div className="text-sm text-muted-foreground">Total: {mine.total.toLocaleString()}</div>
                            </div>

                            <RequestsTable
                                rows={mine.rows}
                                mode="mine"
                                acting={actions.acting}
                                onCancel={(id) => actions.cancel(id)}
                                meta={{ total_count: mine.total }}
                                page={Number(mine.query.page ?? 1)}
                                pageSize={Number(mine.query.page_size ?? 50)}
                                onPageChange={(page) =>
                                    mine.setQuery((q) => ({
                                        ...q,
                                        page,
                                    }))
                                }
                                onPageSizeChange={(page_size) =>
                                    mine.setQuery((q) => ({
                                        ...q,
                                        page_size,
                                        page: 1,
                                    }))
                                }
                                footerItemLabel="requests"
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <RejectDialog
                open={rejectingId != null}
                onOpenChange={(v) => !v && setRejectingId(null)}
                loading={actions.acting}
                onConfirm={(reason) => {
                    if (!rejectingId) return;
                    actions.reject(rejectingId, reason);
                    setRejectingId(null);
                }}
            />

            <CreateRequestDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                priceTypes={priceTypes}
                onCreated={() => {
                    inbox.refresh();
                    mine.refresh();
                }}
            />
        </div>
    );
}