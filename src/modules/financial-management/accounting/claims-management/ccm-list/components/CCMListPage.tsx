//src/modules/financial-management-system/claims-management/ccm-list/components/CCMListPage.tsx
"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Filter,
    Info,
} from "lucide-react";

import type { CCMListQuery, CCMRow } from "../utils/types";
import { useCCMList } from "../hooks/useCCMList";
import { CCMFilters } from "./CCMFilters";
import { CCMListTable } from "./CCMListTable";
import { CCMDetailsDialog } from "./CCMDetailsDialog";

function summarizeFilters(q: CCMListQuery) {
    const parts: string[] = [];
    if (q.q) parts.push(`Search: "${q.q}"`);
    if (q.status) parts.push(`Status: ${q.status}`);
    if (q.supplier_id) parts.push(`Supplier: #${q.supplier_id}`);
    if (q.customer_id) parts.push(`Customer: #${q.customer_id}`);
    return parts;
}

export default function CCMListPage() {
    const [query, setQuery] = React.useState<CCMListQuery>({
        q: "",
        status: "",
        supplier_id: "",
        customer_id: "",
        page: 1,
        pageSize: 20,
    });

    const { rows, total, loading, error } = useCCMList(query);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const pageCount = Math.max(1, Math.ceil((total || 0) / pageSize));

    const [open, setOpen] = React.useState(false);
    const [selected, setSelected] = React.useState<CCMRow | null>(null);

    function patch(p: Partial<CCMListQuery>) {
        setQuery((q) => ({ ...q, ...p }));
    }

    function reset() {
        setQuery({
            q: "",
            status: "",
            supplier_id: "",
            customer_id: "",
            page: 1,
            pageSize: 20,
        });
    }

    const canPrev = page > 1;
    const canNext = page < pageCount;

    const activeFilters = summarizeFilters(query);

    return (
        <div className="space-y-4 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-semibold tracking-tight">
                            Customer Credit Memos
                        </h1>
                        <Badge variant="secondary" className="font-mono">
                            {loading ? "Loading…" : `${total} total`}
                        </Badge>
                        <Badge variant="outline" className="font-mono">
                            {`Page ${page}/${pageCount}`}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Browse CCMs (source from another module). Filter, review, and open a memo to view details.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => patch({ page })}
                        disabled={loading}
                    >
                        <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4 md:p-5">
                <div className="mb-3 flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">Filters</div>
                    <div className="ml-auto flex items-center gap-2">
                        {activeFilters.length > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                                {activeFilters.length} active
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-xs">
                                None
                            </Badge>
                        )}
                    </div>
                </div>

                <CCMFilters query={query} onChange={patch} onReset={reset} />

                {/* Friendly filter summary */}
                {activeFilters.length > 0 ? (
                    <>
                        <Separator className="my-4" />
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Info className="h-4 w-4" />
                            <span>Active:</span>
                            {activeFilters.map((t, idx) => (
                                <Badge key={idx} variant="outline" className="font-normal">
                                    {t}
                                </Badge>
                            ))}
                        </div>
                    </>
                ) : null}
            </Card>

            {/* Error */}
            {error ? (
                <Card className="border-destructive/40 p-4">
                    <div className="text-sm font-medium text-destructive">
                        Failed to load CCMs
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{error}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                        Check Directus collection names and API routes for CCM, suppliers, and customers.
                    </div>
                </Card>
            ) : null}

            {/* Table */}
            <CCMListTable
                rows={rows}
                loading={loading}
                onView={(row) => {
                    setSelected(row);
                    setOpen(true);
                }}
            />

            {/* Footer / Pagination */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                    Showing{" "}
                    <span className="font-medium text-foreground">{rows.length}</span>{" "}
                    row(s) on this page •{" "}
                    <span className="font-medium text-foreground">{total}</span>{" "}
                    total
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!canPrev || loading}
                        onClick={() => patch({ page: page - 1 })}
                    >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Prev
                    </Button>

                    <div className="min-w-[140px] rounded-md border px-3 py-2 text-center text-sm">
                        Page <span className="font-medium">{page}</span> of{" "}
                        <span className="font-medium">{pageCount}</span>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={!canNext || loading}
                        onClick={() => patch({ page: page + 1 })}
                    >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Modal */}
            <CCMDetailsDialog
                open={open}
                onOpenChange={(v) => {
                    setOpen(v);
                    if (!v) setSelected(null);
                }}
                row={selected}
            />
        </div>
    );
}
