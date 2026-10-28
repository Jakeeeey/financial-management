import { Fragment, useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { FinancialAccount } from "../types";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
import { DrillDownModal } from "./DrillDownModal";
import { describePesoChange, formatPesoAmount } from "../utils/presentation";

type MajorClassification = "Assets" | "Liabilities" | "Equity";
type StatementGroup = { label: string; accounts: FinancialAccount[] };

const majorClassifications: MajorClassification[] = ["Assets", "Liabilities", "Equity"];
const expectedGroups: Record<MajorClassification, string[]> = {
    Assets: ["Current Assets", "Non-Current Assets"],
    Liabilities: ["Current Liabilities", "Non-Current Liabilities"],
    Equity: ["Equity", "Equity (Current Net Income)", "Share Capital", "Retained Earnings"],
};

function normalize(value: string) {
    return value.trim().toLocaleLowerCase();
}

function groupAccounts(accounts: FinancialAccount[], major: string): StatementGroup[] {
    const majorAccounts = accounts.filter((account) => normalize(account.type) === normalize(major));
    const groups = new Map<string, FinancialAccount[]>();
    const expected = expectedGroups[major as MajorClassification] ?? [];

    if (major === "Assets" || major === "Liabilities") {
        for (const label of expected) groups.set(label, []);
    }

    for (const account of majorAccounts) {
        const rawGroup = account.group.trim();
        const knownGroup = expected.find((label) => normalize(label) === normalize(rawGroup));
        const label = knownGroup ?? "Other";
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label)!.push(account);
    }

    return [...groups].map(([label, groupedAccounts]) => ({ label, accounts: groupedAccounts }));
}

function formatReportDate(value: string) {
    return new Intl.DateTimeFormat("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
}

function SectionAmount({ value }: { value: number }) {
    return <span className="tabular-nums">{formatPesoAmount(value)}</span>;
}

export function BalanceSheetStatementView() {
    const { accounts, summary, comparisonSummary, appliedFilters, comparisonStatus, validation, reportStatus } = useBalanceSheet();
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
    const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null);
    const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);
    const invokingElementRef = useRef<HTMLButtonElement | null>(null);
    const idPrefix = useId();
    const comparisonEnabled = appliedFilters?.includeComparison === true;
    const comparisonAvailable = comparisonStatus === "available";

    if (reportStatus === "loading-initial") {
        return (
            <Card className="animate-pulse" aria-busy="true">
                <CardHeader className="space-y-2">
                    <div className="h-5 w-40 rounded bg-muted" />
                    <div className="h-4 w-56 max-w-full rounded bg-muted" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {Array.from({ length: 7 }, (_, index) => <div key={index} className="h-10 rounded bg-muted" />)}
                </CardContent>
            </Card>
        );
    }

    if (!summary || accounts.length === 0) {
        return (
            <Card>
                <CardHeader><CardTitle className="text-base">Statement</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    No account balances are available for the applied report criteria.
                </CardContent>
            </Card>
        );
    }

    const toggleGroup = (key: string) => {
        setExpandedGroups((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const openDrillDown = (account: FinancialAccount, invokingElement: HTMLButtonElement) => {
        invokingElementRef.current = invokingElement;
        setSelectedAccount(account);
        setIsDrillDownOpen(true);
    };

    const currentTotal = (groupedAccounts: FinancialAccount[]) => groupedAccounts.reduce((total, account) => total + account.currentPeriod, 0);
    const priorTotal = (groupedAccounts: FinancialAccount[]) => groupedAccounts.reduce((total, account) => total + (account.priorPeriod ?? 0), 0);
    const variance = (groupedAccounts: FinancialAccount[]) => currentTotal(groupedAccounts) - priorTotal(groupedAccounts);
    const comparisonDate = appliedFilters?.comparisonEndDate;
    const equationBalanced = validation.isBalanced;
    const displayedClassifications = [
        ...majorClassifications,
        ...Array.from(new Set(accounts.map((account) => account.type.trim())))
            .filter((type) => !majorClassifications.some((major) => normalize(major) === normalize(type))),
    ];

    return (
        <Card className="min-w-0 overflow-hidden shadow-none">
            <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-base">Statement</CardTitle>
                <p className="text-sm text-muted-foreground">
                    As of {appliedFilters ? formatReportDate(appliedFilters.endDate) : "date unavailable"}
                    {comparisonEnabled && comparisonDate && <> · Comparison as of {formatReportDate(comparisonDate)}</>}
                </p>
                {comparisonEnabled && !comparisonAvailable && (
                    <p role="status" className="text-sm text-muted-foreground">
                        Comparison unavailable. Variances are not calculated.
                    </p>
                )}
            </CardHeader>
            <CardContent className="min-w-0 p-0">
                <Table className="min-w-[760px]">
                    <caption className="sr-only">
                        Balance sheet statement as of {appliedFilters ? formatReportDate(appliedFilters.endDate) : "date unavailable"}
                    </caption>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[48%]">Statement line</TableHead>
                            <TableHead className="text-right">As of {appliedFilters ? formatReportDate(appliedFilters.endDate) : "date unavailable"}</TableHead>
                            {comparisonEnabled && (
                                <>
                                    <TableHead className="text-right">As of {comparisonDate ? formatReportDate(comparisonDate) : "comparison date unavailable"}</TableHead>
                                    <TableHead className="text-right">Variance</TableHead>
                                </>
                            )}
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>

                    {displayedClassifications.map((major) => {
                        const groups = groupAccounts(accounts, major);
                        const classifiedAccounts = accounts.filter((account) => normalize(account.type) === normalize(major));
                        const isStandardClassification = majorClassifications.includes(major as MajorClassification);
                        const total = major === "Assets"
                            ? summary.totalAssets
                            : major === "Liabilities"
                                ? summary.totalLiabilities
                                : major === "Equity"
                                    ? summary.totalEquity
                                    : currentTotal(classifiedAccounts);
                        const comparisonMajorTotal = major === "Assets"
                            ? comparisonSummary?.totalAssets
                            : major === "Liabilities"
                                ? comparisonSummary?.totalLiabilities
                                : major === "Equity"
                                    ? comparisonSummary?.totalEquity
                                    : priorTotal(classifiedAccounts);
                        const sectionTitle = isStandardClassification ? major : `Other classification · ${major}`;
                        const totalTitle = isStandardClassification ? `Total ${major}` : `Subtotal · ${major}`;

                        return (
                            <Fragment key={major}>
                                <TableBody>
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableCell colSpan={comparisonEnabled ? 5 : 3} className="py-3 font-bold uppercase tracking-wide text-foreground">{sectionTitle}</TableCell>
                                    </TableRow>
                                </TableBody>
                                {groups.map((group) => {
                                    const key = `${major}:${group.label}`;
                                    const controlsId = `${idPrefix}-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                                    const expanded = expandedGroups.has(key);
                                    const hasAccounts = group.accounts.length > 0;
                                    const groupCurrent = currentTotal(group.accounts);
                                    const groupPrior = priorTotal(group.accounts);

                                    return (
                                        <Fragment key={key}>
                                            <TableBody>
                                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                                                <TableCell>
                                                    {hasAccounts ? (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-auto justify-start gap-2 px-1 py-1 font-semibold focus-visible:ring-2 focus-visible:ring-ring"
                                                            aria-expanded={expanded}
                                                            aria-controls={controlsId}
                                                            onClick={() => toggleGroup(key)}
                                                        >
                                                            {expanded ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
                                                            {group.label}
                                                            <span className="text-xs font-normal text-muted-foreground">{hasAccounts ? `(${group.accounts.length})` : ""}</span>
                                                        </Button>
                                                    ) : (
                                                        <span className="px-1 font-semibold">{group.label}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold"><SectionAmount value={groupCurrent} /></TableCell>
                                                {comparisonEnabled && (
                                                    <>
                                                        <TableCell className="text-right font-semibold">
                                                            {comparisonAvailable ? <SectionAmount value={groupPrior} /> : <span className="text-sm font-normal text-muted-foreground">Comparison unavailable</span>}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {comparisonAvailable ? describePesoChange(variance(group.accounts)) : <span className="text-sm font-normal text-muted-foreground">Comparison unavailable</span>}
                                                        </TableCell>
                                                    </>
                                                )}
                                                <TableCell />
                                            </TableRow>
                                            </TableBody>
                                            {hasAccounts && (
                                                <TableBody id={controlsId} hidden={!expanded}>
                                                    {group.accounts.map((account) => (
                                                        <TableRow key={account.id}>
                                                            <TableCell className="pl-10">
                                                                <div className="flex min-w-0 flex-col gap-0.5">
                                                                    <span className="font-medium">{account.account}</span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {account.code}{group.label === "Other" ? ` · ${account.group}` : ""}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <SectionAmount value={account.currentPeriod} />
                                                                    {account.currentBalanceStatus === "zero" && <span className="text-xs text-muted-foreground">Zero balance</span>}
                                                                </div>
                                                            </TableCell>
                                                            {comparisonEnabled && (
                                                                <>
                                                                    <TableCell className="text-right">
                                                                        {comparisonStatus === "unavailable" ? (
                                                                            <span className="text-sm text-muted-foreground">Comparison unavailable</span>
                                                                        ) : (
                                                                            <div className="flex flex-col items-end">
                                                                                <SectionAmount value={account.priorPeriod ?? 0} />
                                                                                {account.comparisonBalanceStatus === "zero" && <span className="text-xs text-muted-foreground">Zero balance</span>}
                                                                            </div>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {account.variance === null
                                                                            ? <span className="text-sm text-muted-foreground">Comparison unavailable</span>
                                                                            : <div className="flex flex-col items-end">
                                                                                <span>{describePesoChange(account.variance)}</span>
                                                                                {account.variancePercentage === null && <span className="text-xs text-muted-foreground">No prior balance</span>}
                                                                            </div>}
                                                                    </TableCell>
                                                                </>
                                                            )}
                                                            <TableCell className="text-right">
                                                                <Button type="button" variant="outline" size="sm" onClick={event => openDrillDown(account, event.currentTarget)}>
                                                                    View entries
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            )}
                                        </Fragment>
                                    );
                                })}
                                <TableBody>
                                    <TableRow className="border-t-2 bg-muted/40 font-bold hover:bg-muted/40">
                                        <TableCell>{totalTitle}</TableCell>
                                        <TableCell className="text-right"><SectionAmount value={total} /></TableCell>
                                        {comparisonEnabled && (
                                            <>
                                                <TableCell className="text-right">
                                                    {comparisonAvailable && comparisonMajorTotal !== undefined
                                                        ? <SectionAmount value={comparisonMajorTotal} />
                                                        : <span className="text-sm font-normal text-muted-foreground">Comparison unavailable</span>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {comparisonAvailable && comparisonMajorTotal !== undefined
                                                    ? describePesoChange(total - comparisonMajorTotal)
                                                        : <span className="text-sm font-normal text-muted-foreground">Comparison unavailable</span>}
                                                </TableCell>
                                            </>
                                        )}
                                        <TableCell />
                                    </TableRow>
                                </TableBody>
                            </Fragment>
                        );
                    })}

                    <tfoot>
                        <TableRow className="bg-muted/60 font-bold hover:bg-muted/60">
                            <TableCell>Total Assets − (Total Liabilities + Total Equity)</TableCell>
                            <TableCell className="text-right"><SectionAmount value={summary.balanceVariance} /></TableCell>
                            {comparisonEnabled && (
                                <>
                                    <TableCell className="text-right text-sm font-normal text-muted-foreground">
                                        {comparisonAvailable ? "See comparison totals above" : "Comparison unavailable"}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-normal text-muted-foreground">
                                        {comparisonAvailable ? "—" : "Comparison unavailable"}
                                    </TableCell>
                                </>
                            )}
                            <TableCell />
                        </TableRow>
                    </tfoot>
                </Table>

                <div className={cn(
                    "m-4 flex items-start gap-3 rounded-lg border p-4",
                    equationBalanced ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"
                )}>
                    {equationBalanced
                        ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                        : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                    <div className="min-w-0">
                        <p className="text-sm font-semibold">Accounting equation check</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Assets − (Liabilities + Equity) = {formatPesoAmount(summary.balanceVariance)}
                        </p>
                        <p className={cn("mt-1 text-sm font-medium", equationBalanced ? "text-success" : "text-destructive")}>
                            {equationBalanced ? "The report balances." : "The report does not balance."}
                        </p>
                    </div>
                </div>
                <p className="px-4 pb-4 text-xs text-muted-foreground">
                    Account subtotals use the listed account balances. Assets, liabilities, equity totals, and the accounting equation use the report summary. Other major classifications are shown without remapping.
                </p>
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
