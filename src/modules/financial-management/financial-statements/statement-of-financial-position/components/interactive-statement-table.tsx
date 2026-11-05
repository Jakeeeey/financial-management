import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FinancialAccount } from "../types";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
import { describePesoChange, formatPesoAmount } from "../utils/presentation";
import { DrillDownModal } from "./DrillDownModal";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;
const SORT_FIELDS = ["account", "code", "currentPeriod", "priorPeriod", "variance"] as const;

type SortField = (typeof SORT_FIELDS)[number];
type SortDirection = "asc" | "desc";
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface TableState {
    search: string;
    sortField: SortField;
    sortDirection: SortDirection;
    pageIndex: number;
    pageSize: PageSize;
}

const DEFAULT_TABLE_STATE: TableState = {
    search: "",
    sortField: "code",
    sortDirection: "asc",
    pageIndex: 0,
    pageSize: 10,
};

const accountCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const formatReportDate = (value: string) => new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
}).format(new Date(`${value}T00:00:00Z`));

function isSortField(value: string | null): value is SortField {
    return value !== null && SORT_FIELDS.includes(value as SortField);
}

function parseTableState(search: string): TableState {
    const params = new URLSearchParams(search);
    const requestedPage = Number(params.get("accountPage"));
    const requestedPageSize = Number(params.get("accountPageSize"));
    const requestedDirection = params.get("accountSortOrder");

    return {
        search: params.get("accountSearch") ?? "",
        sortField: isSortField(params.get("accountSortField"))
            ? params.get("accountSortField") as SortField
            : DEFAULT_TABLE_STATE.sortField,
        sortDirection: requestedDirection === "desc" ? "desc" : "asc",
        pageIndex: Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0,
        pageSize: PAGE_SIZE_OPTIONS.includes(requestedPageSize as PageSize)
            ? requestedPageSize as PageSize
            : DEFAULT_TABLE_STATE.pageSize,
    };
}

function getSortValue(account: FinancialAccount, field: SortField): string | number | null {
    switch (field) {
        case "account":
            return account.account;
        case "code":
            return account.code;
        case "currentPeriod":
            return account.currentPeriod;
        case "priorPeriod":
            return account.priorPeriod;
        case "variance":
            return account.variance;
    }
}

function compareAccounts(a: FinancialAccount, b: FinancialAccount, field: SortField, direction: SortDirection) {
    const aValue = getSortValue(a, field);
    const bValue = getSortValue(b, field);

    // Keep missing comparison values last in either direction.
    if (aValue === null && bValue !== null) return 1;
    if (bValue === null && aValue !== null) return -1;

    let comparison = 0;
    if (aValue !== null && bValue !== null) {
        comparison = typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : accountCollator.compare(String(aValue), String(bValue));
    }

    if (comparison !== 0) return direction === "asc" ? comparison : -comparison;
    return accountCollator.compare(a.code, b.code) || accountCollator.compare(a.account, b.account);
}

function formatSortLabel(field: SortField, appliedDate: string, comparisonDate: string | undefined) {
    switch (field) {
        case "account": return "Account title";
        case "code": return "GL code";
        case "currentPeriod": return `As of ${appliedDate}`;
        case "priorPeriod": return `Comparison balance as of ${comparisonDate}`;
        case "variance": return "Variance";
    }
}

export function InteractiveStatementTable() {
    const { accounts, reportStatus, appliedFilters, comparisonStatus } = useBalanceSheet();
    const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null);
    const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);
    const invokingElementRef = useRef<HTMLButtonElement | null>(null);
    const [search, setSearch] = useState(DEFAULT_TABLE_STATE.search);
    const [sortField, setSortField] = useState<SortField>(DEFAULT_TABLE_STATE.sortField);
    const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_TABLE_STATE.sortDirection);
    const [pageIndex, setPageIndex] = useState(DEFAULT_TABLE_STATE.pageIndex);
    const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_TABLE_STATE.pageSize);
    const [tableStateReady, setTableStateReady] = useState(false);
    const comparisonEnabled = appliedFilters?.includeComparison === true;
    const comparisonSortFieldUnavailable = !comparisonEnabled && (sortField === "priorPeriod" || sortField === "variance");
    const effectiveSortField = comparisonSortFieldUnavailable ? DEFAULT_TABLE_STATE.sortField : sortField;
    const effectiveSortDirection = comparisonSortFieldUnavailable ? DEFAULT_TABLE_STATE.sortDirection : sortDirection;

    useEffect(() => {
        const readStateFromUrl = () => {
            const state = parseTableState(window.location.search);
            setSearch(state.search);
            setSortField(state.sortField);
            setSortDirection(state.sortDirection);
            setPageIndex(state.pageIndex);
            setPageSize(state.pageSize);
            setTableStateReady(true);
        };

        readStateFromUrl();
        window.addEventListener("popstate", readStateFromUrl);
        return () => window.removeEventListener("popstate", readStateFromUrl);
    }, []);

    const matchingAccounts = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        if (!query) return accounts;
        return accounts.filter(account =>
            account.account.toLocaleLowerCase().includes(query)
            || account.code.toLocaleLowerCase().includes(query)
        );
    }, [accounts, search]);

    const sortedAccounts = useMemo(
        () => [...matchingAccounts].sort((a, b) => compareAccounts(a, b, effectiveSortField, effectiveSortDirection)),
        [effectiveSortDirection, effectiveSortField, matchingAccounts],
    );

    const pageCount = Math.max(1, Math.ceil(sortedAccounts.length / pageSize));
    const effectivePageIndex = Math.min(pageIndex, pageCount - 1);
    const pageAccounts = sortedAccounts.slice(effectivePageIndex * pageSize, (effectivePageIndex + 1) * pageSize);
    const firstVisibleAccount = sortedAccounts.length === 0 ? 0 : effectivePageIndex * pageSize + 1;
    const lastVisibleAccount = Math.min((effectivePageIndex + 1) * pageSize, sortedAccounts.length);

    useEffect(() => {
        if (!tableStateReady) return;

        const url = new URL(window.location.href);
        const params = url.searchParams;

        if (search) params.set("accountSearch", search);
        else params.delete("accountSearch");

        if (effectiveSortField !== DEFAULT_TABLE_STATE.sortField) params.set("accountSortField", effectiveSortField);
        else params.delete("accountSortField");

        if (effectiveSortDirection !== DEFAULT_TABLE_STATE.sortDirection) params.set("accountSortOrder", effectiveSortDirection);
        else params.delete("accountSortOrder");

        if (effectivePageIndex > 0) params.set("accountPage", String(effectivePageIndex));
        else params.delete("accountPage");

        if (pageSize !== DEFAULT_TABLE_STATE.pageSize) params.set("accountPageSize", String(pageSize));
        else params.delete("accountPageSize");

        const nextUrl = `${url.pathname}${url.search}${url.hash}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (nextUrl !== currentUrl) {
            window.history.replaceState(window.history.state, "", nextUrl);
        }
    }, [effectivePageIndex, effectiveSortDirection, effectiveSortField, pageSize, search, tableStateReady]);

    const handleDrillDown = (account: FinancialAccount, invokingElement: HTMLButtonElement) => {
        invokingElementRef.current = invokingElement;
        setSelectedAccount(account);
        setIsDrillDownOpen(true);
    };

    const handleSort = (field: SortField) => {
        if (effectiveSortField === field && sortField === field) {
            setSortDirection(currentDirection => currentDirection === "asc" ? "desc" : "asc");
            return;
        }
        setSortField(field);
        setSortDirection("asc");
    };

    const formatVariance = (account: FinancialAccount) => {
        if (account.comparisonBalanceStatus === "unavailable" || account.variance === null) {
            return <span className="text-sm text-muted-foreground">Comparison unavailable</span>;
        }

        return (
            <span className="flex flex-col items-end">
                <span className="font-medium">{describePesoChange(account.variance)}</span>
                {account.variancePercentage === null
                    ? <span className="text-xs text-muted-foreground">No prior balance</span>
                    : <span className="text-xs text-muted-foreground">Percentage change: {account.variancePercentage > 0 ? "+" : ""}{account.variancePercentage.toFixed(1)}%</span>}
            </span>
        );
    };

    const renderSortHeader = (
        field: SortField,
        label: string,
        align: "left" | "right" = "left",
        stickyOffset?: "first" | "second",
    ) => {
        const isActive = effectiveSortField === field;
        const directionLabel = isActive ? effectiveSortDirection === "asc" ? "ascending" : "descending" : undefined;
        const Icon = isActive ? effectiveSortDirection === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
        const stickyClass = stickyOffset === "first"
            ? "sticky left-0 z-40 w-[240px] min-w-[240px] max-w-[240px]"
            : stickyOffset === "second"
                ? "sticky left-[240px] z-40 w-[130px] min-w-[130px] max-w-[130px]"
                : "sticky top-0 z-30";

        return (
            <th
                key={field}
                scope="col"
                aria-sort={isActive ? effectiveSortDirection === "asc" ? "ascending" : "descending" : undefined}
                className={`${stickyClass} top-0 border-b bg-muted/95 px-4 py-3 font-medium text-muted-foreground ${align === "right" ? "text-right" : "text-left"}`}
            >
                <button
                    type="button"
                    onClick={() => handleSort(field)}
                    aria-label={`Sort by ${label}${directionLabel ? `; currently ${directionLabel}` : ""}`}
                    className={`inline-flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${align === "right" ? "ml-auto" : ""}`}
                >
                    {label}
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                </button>
            </th>
        );
    };

    if (reportStatus === "loading-initial") {
        return (
            <Card className="min-w-0 overflow-hidden border shadow-none" aria-busy="true">
                <CardHeader className="border-b border-border/50 pb-3">
                    <div className="space-y-2">
                        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
                    </div>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden p-4 pt-6">
                    <div className="overflow-x-auto">
                        <div className="min-w-[720px] space-y-3">
                            <div className="grid grid-cols-6 gap-4 border-b pb-3">
                                {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-4 animate-pulse rounded bg-muted" />)}
                            </div>
                            {Array.from({ length: 6 }, (_, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-6 gap-4 border-b py-3">
                                    {Array.from({ length: 6 }, (_, columnIndex) => (
                                        <div key={columnIndex} className="h-4 animate-pulse rounded bg-muted" />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (reportStatus === "not-generated" || reportStatus === "initial-error") {
        return null;
    }

    const appliedDate = appliedFilters ? formatReportDate(appliedFilters.endDate) : "date unavailable";
    const comparisonDate = appliedFilters ? formatReportDate(appliedFilters.comparisonEndDate) : undefined;
    const sortLabel = formatSortLabel(effectiveSortField, appliedDate, comparisonDate);
    const sortDirectionLabel = effectiveSortField === "account" || effectiveSortField === "code"
        ? effectiveSortDirection === "asc" ? "A–Z" : "Z–A"
        : effectiveSortDirection === "asc" ? "ascending" : "descending";
    const columnCount = comparisonEnabled ? 6 : 4;

    return (
        <Card className="min-w-0 overflow-hidden border shadow-none" aria-busy={reportStatus === "refreshing"}>
            <CardHeader className="border-b border-border/50 pb-3">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                        <div className="mb-1 flex flex-wrap items-center gap-3">
                            <CardTitle className="text-base font-semibold">Account breakdown</CardTitle>
                            <Badge variant="secondary" className="border font-normal">
                                Sorted by {sortLabel} · {sortDirectionLabel}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            As of {appliedDate}
                            {comparisonEnabled && (
                                <> · Comparison as of {comparisonDate}
                                    {comparisonStatus === "unavailable" && <> · Comparison unavailable</>}</>
                            )}
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="min-w-0 space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="w-full max-w-md space-y-1.5">
                        <label htmlFor="balance-sheet-account-search" className="text-sm font-medium">Find an account</label>
                        <div className="relative">
                            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="balance-sheet-account-search"
                                type="search"
                                value={search}
                                onChange={event => {
                                    setSearch(event.target.value);
                                    setPageIndex(0);
                                }}
                                placeholder="Search account title or GL code"
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <span aria-live="polite" aria-atomic="true">
                            <span className="font-medium">{sortedAccounts.length} matching account{sortedAccounts.length === 1 ? "" : "s"}</span>
                            <span className="text-muted-foreground"> · {accounts.length} in the applied report</span>
                        </span>
                        <Badge variant="outline">Totals cover the full applied report</Badge>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    Search narrows the visible account rows only; report figures and exports continue to cover the full applied report.
                </p>

                <div className="w-full overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[980px] border-collapse text-sm">
                        <thead>
                            <tr>
                                {renderSortHeader("account", "Account", "left", "first")}
                                {renderSortHeader("code", "GL code", "left", "second")}
                                {renderSortHeader("currentPeriod", `As of ${appliedDate}`, "right")}
                                {comparisonEnabled && renderSortHeader("priorPeriod", `Comparison as of ${comparisonDate}`, "right")}
                                {comparisonEnabled && renderSortHeader("variance", "Variance", "right")}
                                <th scope="col" className="sticky top-0 z-30 min-w-[130px] border-b bg-muted/95 px-4 py-3 text-right font-medium text-muted-foreground">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageAccounts.map(account => (
                                <tr key={account.coaId ?? account.id} className="border-b last:border-0">
                                    <td className="sticky left-0 z-20 w-[240px] min-w-[240px] max-w-[240px] border-r bg-card px-4 py-3">
                                        <div className="flex flex-col break-words">
                                            <span className="font-medium">{account.account}</span>
                                            <span className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                                                {account.type} · {account.group}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="sticky left-[240px] z-20 w-[130px] min-w-[130px] max-w-[130px] border-r bg-card px-4 py-3 font-medium text-muted-foreground">
                                        {account.code}
                                    </td>
                                    <td className="min-w-[170px] px-4 py-3 text-right">
                                        <div className="flex flex-col items-end font-medium">
                                            <span>{formatPesoAmount(account.currentPeriod)}</span>
                                            {account.currentBalanceStatus === "zero" && (
                                                <span className="text-xs font-normal text-muted-foreground">Zero balance</span>
                                            )}
                                        </div>
                                    </td>
                                    {comparisonEnabled && (
                                        <>
                                            <td className="min-w-[180px] px-4 py-3 text-right font-medium text-muted-foreground">
                                                <div className="flex flex-col items-end">
                                                    {account.comparisonBalanceStatus === "unavailable" ? (
                                                        <span className="text-sm">Comparison unavailable</span>
                                                    ) : (
                                                        <span>{formatPesoAmount(account.priorPeriod ?? 0)}</span>
                                                    )}
                                                    {account.comparisonBalanceStatus === "zero" && (
                                                        <span className="text-xs font-normal">Zero balance</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="min-w-[200px] px-4 py-3 text-right">
                                                {formatVariance(account)}
                                            </td>
                                        </>
                                    )}
                                    <td className="min-w-[130px] px-4 py-3 text-right">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-full text-xs font-normal"
                                            onClick={event => handleDrillDown(account, event.currentTarget)}
                                        >
                                            View entries
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {pageAccounts.length === 0 && (
                                <tr>
                                    <td colSpan={columnCount} className="px-4 py-10 text-center">
                                        <p className="font-medium">{accounts.length === 0 ? "No account balances are available for this report." : "No accounts match your search."}</p>
                                        {accounts.length > 0 && <p className="mt-1 text-sm text-muted-foreground">Try another account title or GL code.</p>}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {firstVisibleAccount}–{lastVisibleAccount} of {sortedAccounts.length} matching accounts
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor="balance-sheet-account-page-size" className="text-sm text-muted-foreground">Rows per page</label>
                        <select
                            id="balance-sheet-account-page-size"
                            value={pageSize}
                            onChange={event => setPageSize(Number(event.target.value) as PageSize)}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                        </select>
                        <span className="min-w-[90px] text-center text-sm text-muted-foreground">Page {effectivePageIndex + 1} of {pageCount}</span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPageIndex(Math.max(0, effectivePageIndex - 1))}
                            disabled={effectivePageIndex === 0}
                        >
                            Previous
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPageIndex(Math.min(pageCount - 1, effectivePageIndex + 1))}
                            disabled={effectivePageIndex >= pageCount - 1}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </CardContent>

            <DrillDownModal
                isOpen={isDrillDownOpen}
                onOpenChange={setIsDrillDownOpen}
                account={selectedAccount}
                invokingElementRef={invokingElementRef}
            />
        </Card>
    );
}
