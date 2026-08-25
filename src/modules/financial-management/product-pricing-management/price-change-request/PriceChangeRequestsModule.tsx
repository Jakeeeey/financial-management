"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCheck, X, Calendar as CalendarIcon } from "lucide-react";

import RequestsTable from "./components/RequestsTable";
import { RejectDialog } from "./components/RejectDialog";

import { usePCRList } from "./hooks/usePCR";
import { usePCRActions } from "./hooks/usePCRActions";
import { getLookups, SupplierOption } from "./providers/pcrApi";
import { SearchableSelect } from "@/components/ui/searchable-select";

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
    const inbox = usePCRList({ status: "PENDING", page_size: 50, page: 1, requestType: type });

    const statusTab = inbox.query.status || "PENDING";

    const [rejectingId, setRejectingId] = React.useState<number | null>(null);
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);

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

    const handleApproveSelected = React.useCallback(async () => {
        if (selectedIds.length === 0) return;

        const result = await actions.approveMany(selectedIds);

        if (result.successIds.length > 0) {
            setSelectedIds((prev) => prev.filter((id) => !result.successIds.includes(id)));
        }
    }, [actions, selectedIds]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <Tabs value={statusTab as string} onValueChange={(v) => {
                    clearSelection();
                    inbox.setQuery((q) => ({ ...q, status: v as import("./types").PCRStatus, page: 1 }));
                }} className="w-full">
                    <TabsList>
                        <TabsTrigger value="PENDING">Pending</TabsTrigger>
                        <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                        <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                    </TabsList>
                </Tabs>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        clearSelection();
                        inbox.refresh();
                    }}
                    disabled={inbox.loading}
                >
                    {inbox.loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Refresh
                </Button>
            </div>

            <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                    <Input
                        placeholder={`Search ${type === "cost" ? "CCR" : "PCR"} # / product...`}
                        value={inbox.query.q ?? ""}
                        onChange={(e) =>
                            inbox.setQuery((q) => ({
                                ...q,
                                q: e.target.value,
                                page: 1,
                            }))
                        }
                        className="w-full sm:max-w-[200px]"
                    />

                    <SearchableSelect
                        className="w-full sm:max-w-[200px]"
                        placeholder="All Suppliers"
                        value={String(inbox.query.supplier_id ?? "")}
                        onValueChange={(val) =>
                            inbox.setQuery((q) => ({
                                ...q,
                                supplier_id: val ? Number(val) : "",
                                page: 1,
                            }))
                        }
                        options={[
                            { value: "", label: "All Suppliers" },
                            ...suppliers.map((s) => ({
                                value: String(s.id),
                                label: s.supplier_name,
                            })),
                        ]}
                    />

                    <div className="flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-colors w-full sm:w-auto">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Date:</span>
                        <input
                            type="date"
                            value={inbox.query.date_from ?? ""}
                            onChange={(e) =>
                                inbox.setQuery((q) => ({ ...q, date_from: e.target.value, page: 1 }))
                            }
                            title="Start Date"
                            className="bg-transparent text-sm outline-none w-[115px] text-muted-foreground focus:text-foreground [&::-webkit-calendar-picker-indicator]:opacity-50"
                        />
                        <span className="text-muted-foreground text-sm">-</span>
                        <input
                            type="date"
                            value={inbox.query.date_to ?? ""}
                            onChange={(e) =>
                                inbox.setQuery((q) => ({ ...q, date_to: e.target.value, page: 1 }))
                            }
                            title="End Date"
                            className="bg-transparent text-sm outline-none w-[115px] text-muted-foreground focus:text-foreground [&::-webkit-calendar-picker-indicator]:opacity-50"
                        />
                    </div>

                    <div className="text-sm text-muted-foreground ml-auto">Total: {inbox.total.toLocaleString()}</div>
                </div>

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
            </div>

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
        </div>
    );
}