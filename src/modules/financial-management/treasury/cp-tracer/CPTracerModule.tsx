"use client";

import {FormEvent, useState} from "react";
import {LoaderCircle, Search} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {useCPTracer} from "./hooks/useCPTracer";
import type {CPTracerReference, CPTracerSearch} from "./types";

const EMPTY_SEARCH: CPTracerSearch = {cp: "", invoice: "", memo: "", sr: ""};

function ReferenceList({items}: {items: CPTracerReference[]}) {
    if (!items.length) return <span className="text-muted-foreground">—</span>;
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
                <span key={item.id} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {item.number}
                </span>
            ))}
        </div>
    );
}

export default function CPTracerModule() {
    const [draft, setDraft] = useState(EMPTY_SEARCH);
    const [search, setSearch] = useState(EMPTY_SEARCH);
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const {data, isLoading, error} = useCPTracer(search, page, refreshKey);
    const hasActiveFilters = Object.values(search).some(Boolean);

    function submitSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const normalized = Object.fromEntries(
            Object.entries(draft).map(([key, value]) => [key, value.trim()]),
        ) as CPTracerSearch;
        setPage(1);
        setSearch(normalized);
        setRefreshKey((current) => current + 1);
    }

    function updateDraft(field: keyof CPTracerSearch, value: string) {
        setDraft((current) => ({...current, [field]: value}));
    }

    const totalPages = Math.max(data.totalPages, 1);

    return (
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 p-3 sm:p-5">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">CP Tracer</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Search across collection pouches, invoices, customer memos, and sales returns.
                </p>
            </div>

            <form onSubmit={submitSearch} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                    {([
                        ["cp", "CP Number", "Search CP number"],
                        ["invoice", "Invoice Number", "Search invoice number"],
                        ["memo", "Memo Number", "Search memo number"],
                        ["sr", "SR Number", "Search sales return number"],
                    ] as const).map(([field, label, placeholder]) => (
                        <label key={field} className="grid gap-1.5 text-sm font-medium">
                            {label}
                            <Input
                                value={draft[field]}
                                onChange={(event) => updateDraft(field, event.target.value)}
                                placeholder={placeholder}
                                maxLength={120}
                            />
                        </label>
                    ))}
                    <div className="flex items-end">
                        <Button type="submit" className="w-full xl:w-auto" disabled={isLoading}>
                            {isLoading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
                            Search
                        </Button>
                    </div>
                </div>
                {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
            </form>

            <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <h2 className="font-medium">Related transactions</h2>
                    {!isLoading && !error && (
                        <span className="text-sm text-muted-foreground">
                            {data.totalElements} {data.totalElements === 1 ? "CP" : "CPs"}
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-40">CP</TableHead>
                                <TableHead className="min-w-64">Invoices</TableHead>
                                <TableHead className="min-w-56">Memo</TableHead>
                                <TableHead className="min-w-56">SR</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Loading related transactions…</TableCell></TableRow>
                            ) : error ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center text-destructive">{error}</TableCell></TableRow>
                            ) : data.content.length ? data.content.map((row) => (
                                <TableRow key={row.cpId}>
                                    <TableCell className="font-semibold">{row.cpNumber}</TableCell>
                                    <TableCell><ReferenceList items={row.invoices} /></TableCell>
                                    <TableCell><ReferenceList items={row.memos} /></TableCell>
                                    <TableCell><ReferenceList items={row.salesReturns} /></TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        {hasActiveFilters ? "No related transactions found." : "No CP records found."}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {data.totalElements > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage((current) => current - 1)} disabled={page <= 1 || isLoading}>
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPage((current) => current + 1)} disabled={page >= totalPages || isLoading}>
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
