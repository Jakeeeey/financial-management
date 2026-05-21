"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Calendar as CalendarIcon } from "lucide-react";

// Note: Ensure these components are available or correctly path-referenced
// We will need to update the import paths since we moved the file
import RequestsTable from "../price-change-request/components/RequestsTable";

import { usePCRList } from "../price-change-request/hooks/usePCR";
import { usePCRActions } from "../price-change-request/hooks/usePCRActions";
import { getLookups, SupplierOption } from "../price-change-request/providers/pcrApi";
import { SearchableSelect } from "@/components/ui/searchable-select";

export function PriceChangeMonitoringModule() {
    const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
    React.useEffect(() => {
        getLookups().then(res => setSuppliers(res.suppliers)).catch(() => {});
    }, []);

    return (
        <div className="space-y-3">
            <Card className="rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle>Price Change Monitoring</CardTitle>
                        <div className="text-sm text-muted-foreground">
                            Monitor your created price change requests.
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
                            <RequestMonitoringManager type="price" suppliers={suppliers} />
                        </TabsContent>

                        <TabsContent value="cost">
                            <RequestMonitoringManager type="cost" suppliers={suppliers} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

function RequestMonitoringManager({ type, suppliers }: { type: "price" | "cost"; suppliers: SupplierOption[] }) {
    const mine = usePCRList({ status: "", page_size: 50, page: 1, requestType: type });

    const actions = usePCRActions(() => {
        mine.refresh();
    }, type);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div></div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        mine.refresh();
                    }}
                    disabled={mine.loading}
                >
                    {mine.loading ? (
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
                        value={mine.query.q ?? ""}
                        onChange={(e) =>
                            mine.setQuery((q) => ({
                                ...q,
                                q: e.target.value,
                                page: 1,
                            }))
                        }
                        className="w-full sm:max-w-[200px]"
                    />

                    <select
                        className="h-9 w-full sm:max-w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={mine.query.status ?? ""}
                        onChange={(e) =>
                            mine.setQuery((q) => ({
                                ...q,
                                status: e.target.value as import("../price-change-request/types").PCRStatus,
                                page: 1,
                            }))
                        }
                    >
                        <option value="">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                    </select>

                    <SearchableSelect
                        className="w-full sm:max-w-[200px]"
                        placeholder="All Suppliers"
                        value={String(mine.query.supplier_id ?? "")}
                        onValueChange={(val) =>
                            mine.setQuery((q) => ({
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
                            value={mine.query.date_from ?? ""}
                            onChange={(e) =>
                                mine.setQuery((q) => ({ ...q, date_from: e.target.value, page: 1 }))
                            }
                            title="Start Date"
                            className="bg-transparent text-sm outline-none w-[115px] text-muted-foreground focus:text-foreground [&::-webkit-calendar-picker-indicator]:opacity-50"
                        />
                        <span className="text-muted-foreground text-sm">-</span>
                        <input
                            type="date"
                            value={mine.query.date_to ?? ""}
                            onChange={(e) =>
                                mine.setQuery((q) => ({ ...q, date_to: e.target.value, page: 1 }))
                            }
                            title="End Date"
                            className="bg-transparent text-sm outline-none w-[115px] text-muted-foreground focus:text-foreground [&::-webkit-calendar-picker-indicator]:opacity-50"
                        />
                    </div>

                    <div className="text-sm text-muted-foreground ml-auto">Total: {mine.total.toLocaleString()}</div>
                </div>

                <RequestsTable
                    rows={mine.rows}
                    mode="mine"
                    requestType={type}
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
            </div>


        </div>
    );
}