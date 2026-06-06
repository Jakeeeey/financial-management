"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CalendarDays, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import type { ListQuery } from "../types";
import type { SupplierOption } from "../providers/pcrApi";

type Props = {
    query: ListQuery;
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>;
    suppliers: SupplierOption[];
    loading: boolean;
    total: number;
    totalLabel: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchHelper: string;
    onRefresh: () => void;
    onReset?: () => void;
};

function safeStr(value: unknown): string {
    const text = String(value ?? "").trim();
    return text && text !== "undefined" && text !== "null" ? text : "";
}

function supplierText(supplier: SupplierOption): string {
    const shortcut = safeStr(supplier.supplier_shortcut);
    const name = safeStr(supplier.supplier_name);
    return shortcut ? `${shortcut} - ${name}` : name || `Supplier #${supplier.id}`;
}

function FilterField(props: {
    label: string;
    helper?: string;
    children: React.ReactNode;
    className?: string;
}) {
    const { label, helper, children, className } = props;

    return (
        <div className={["flex min-w-0 flex-col gap-1.5", className].filter(Boolean).join(" ")}>
            <Label className="text-xs font-medium text-foreground">{label}</Label>
            {children}
            {helper ? <p className="text-[11px] leading-snug text-muted-foreground">{helper}</p> : null}
        </div>
    );
}

export function RequestFiltersBar(props: Props) {
    const {
        query,
        setQuery,
        suppliers,
        loading,
        total,
        totalLabel,
        searchLabel,
        searchPlaceholder,
        searchHelper,
        onRefresh,
        onReset,
    } = props;

    const [localQ, setLocalQ] = React.useState(query.q ?? "");

    React.useEffect(() => {
        setLocalQ(query.q ?? "");
    }, [query.q]);

    const supplierOptions = React.useMemo(
        () => [
            { value: "", label: "All suppliers" },
            ...suppliers.map((supplier) => ({
                value: String(supplier.id),
                label: supplierText(supplier),
            })),
        ],
        [suppliers],
    );

    const selectedSupplierLabel = React.useMemo(() => {
        const supplierId = String(query.supplier_id ?? "");
        if (!supplierId) return "";
        return supplierOptions.find((option) => option.value === supplierId)?.label ?? `Supplier #${supplierId}`;
    }, [query.supplier_id, supplierOptions]);

    const applySearch = React.useCallback(() => {
        setQuery((prev) => ({
            ...prev,
            q: localQ.trim(),
            page: 1,
        }));
    }, [localQ, setQuery]);

    const clearSearch = React.useCallback(() => {
        setLocalQ("");
        setQuery((prev) => ({
            ...prev,
            q: "",
            page: 1,
        }));
    }, [setQuery]);

    const setSupplier = React.useCallback(
        (value: string) => {
            setQuery((prev) => ({
                ...prev,
                supplier_id: value ? Number(value) : "",
                page: 1,
            }));
        },
        [setQuery],
    );

    const setDate = React.useCallback(
        (key: "date_from" | "date_to", value: string) => {
            setQuery((prev) => ({
                ...prev,
                [key]: value,
                page: 1,
            }));
        },
        [setQuery],
    );

    const resetFilters = React.useCallback(() => {
        setLocalQ("");
        setQuery((prev) => ({
            ...prev,
            status: "PENDING",
            q: "",
            supplier_id: "",
            date_from: "",
            date_to: "",
            page: 1,
        }));
        onReset?.();
    }, [onReset, setQuery]);

    const q = safeStr(query.q);
    const hasDateRange = Boolean(query.date_from || query.date_to);
    const hasFilters = Boolean(q || query.supplier_id || hasDateRange || query.status !== "PENDING");

    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (q) {
        chips.push({
            key: "search",
            label: `Search: ${q}`,
            onRemove: clearSearch,
        });
    }

    if (query.supplier_id) {
        chips.push({
            key: "supplier",
            label: `Supplier: ${selectedSupplierLabel}`,
            onRemove: () => setSupplier(""),
        });
    }

    if (hasDateRange) {
        const from = query.date_from || "Any start";
        const to = query.date_to || "Any end";
        chips.push({
            key: "date",
            label: `Date: ${from} to ${to}`,
            onRemove: () => {
                setQuery((prev) => ({
                    ...prev,
                    date_from: "",
                    date_to: "",
                    page: 1,
                }));
            },
        });
    }

    if (query.status && query.status !== "PENDING") {
        chips.push({
            key: "status",
            label: `Status: ${query.status}`,
            onRemove: () => {
                setQuery((prev) => ({
                    ...prev,
                    status: "PENDING",
                    page: 1,
                }));
            },
        });
    }

    return (
        <Card className="overflow-hidden rounded-2xl shadow-sm">
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-foreground">Request filters</h2>
                        <p className="text-xs text-muted-foreground">
                            Search, narrow by supplier, or review requests within a specific date range.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{total.toLocaleString()}</span> {totalLabel}
                        </div>
                        {hasFilters ? (
                            <Button
                                variant="ghost"
                                className="h-8 gap-2 text-muted-foreground hover:text-foreground"
                                onClick={resetFilters}
                                type="button"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Reset filters
                            </Button>
                        ) : null}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRefresh}
                            disabled={loading}
                            type="button"
                        >
                            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(260px,1.35fr)_minmax(210px,0.9fr)_minmax(170px,0.65fr)_minmax(170px,0.65fr)]">
                    <FilterField label={searchLabel} helper={searchHelper}>
                        <InputGroup className="h-10 bg-background">
                            <InputGroupAddon align="inline-start">
                                <Search className="h-4 w-4" />
                            </InputGroupAddon>
                            <InputGroupInput
                                placeholder={searchPlaceholder}
                                value={localQ}
                                onChange={(event) => setLocalQ(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        applySearch();
                                    }
                                }}
                            />
                            <InputGroupAddon align="inline-end" className="gap-1">
                                {localQ ? (
                                    <InputGroupButton
                                        size="icon-xs"
                                        variant="ghost"
                                        onClick={clearSearch}
                                        title="Clear search"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </InputGroupButton>
                                ) : null}
                                <InputGroupButton
                                    size="sm"
                                    variant="secondary"
                                    onClick={applySearch}
                                    title="Search requests"
                                >
                                    Search
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                    </FilterField>

                    <FilterField label="Supplier" helper={query.supplier_id ? "Showing requests for one supplier." : "All suppliers included."}>
                        <SearchableSelect
                            className="h-10 w-full justify-between bg-background shadow-none"
                            placeholder="All suppliers"
                            value={String(query.supplier_id ?? "")}
                            onValueChange={setSupplier}
                            options={supplierOptions}
                        />
                    </FilterField>

                    <FilterField label="From date" helper="Start date.">
                        <div className="flex h-10 min-w-0 items-center gap-2 rounded-md border bg-background px-3">
                            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                                type="date"
                                value={query.date_from ?? ""}
                                onChange={(event) => setDate("date_from", event.target.value)}
                                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                            />
                        </div>
                    </FilterField>

                    <FilterField label="To date" helper="End date.">
                        <div className="flex h-10 min-w-0 items-center gap-2 rounded-md border bg-background px-3">
                            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                                type="date"
                                value={query.date_to ?? ""}
                                onChange={(event) => setDate("date_to", event.target.value)}
                                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                            />
                        </div>
                    </FilterField>
                </div>
            </div>

            {chips.length > 0 ? (
                <div className="border-t bg-muted/10 px-4 py-3">
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium text-muted-foreground">Active filters</div>
                        <div className="flex flex-wrap items-center gap-2">
                            {chips.map((chip) => (
                                <Badge
                                    key={chip.key}
                                    variant="secondary"
                                    className="flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs"
                                >
                                    <span className="max-w-[520px] truncate">{chip.label}</span>
                                    <button
                                        type="button"
                                        onClick={chip.onRemove}
                                        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
                                        aria-label={`Remove ${chip.label}`}
                                        title="Remove"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}
        </Card>
    );
}
