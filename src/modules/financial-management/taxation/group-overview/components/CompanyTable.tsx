"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { PAGE_SIZE, REGIME_SHORT, netPositionClass, statusLabel } from "../constants";
import type { GroupAttentionItem, GroupCompanyRow } from "../types";
import { CompanyDetailDialog } from "./CompanyDetailDialog";
import { StatusBadge } from "./StatusBadge";
import { TablePager } from "./TablePager";

const COLUMNS = 8;

/** Companies with no figures get a dash: `₱0.00` would claim they earned nothing. */
const NO_FIGURES: ReadonlySet<string> = new Set(["UNREADABLE", "NOT_ENTERED"]);

function regimeLabel(row: GroupCompanyRow) {
  if (!row.regime) return row.reachable ? "Unknown" : "—";
  return REGIME_SHORT[row.regime] ?? row.regime;
}

function money(row: GroupCompanyRow, value: number) {
  if (NO_FIGURES.has(row.status)) return "—";
  // formatCurrency opens negatives with an ASCII hyphen; the rest of the page uses U+2212.
  return formatCurrency(Math.abs(value) < 0.005 ? 0 : value).replace(/^-/, "−");
}

/** The dialog counts the attention items that name this company. */
function countAttention(attention: GroupAttentionItem[], row: GroupCompanyRow) {
  return attention.filter((item) => item.companyCode === row.code).length;
}

/**
 * The group's per-company position for one year.
 *
 * Nine columns do not fit on a phone, so below `xl` the same fields are printed as
 * cards. Both views read one page of rows from the same slice, and both open the
 * company dialog on click or on Enter/Space.
 */
export function CompanyTable({
  rows,
  isLoading,
  attention,
}: {
  rows: GroupCompanyRow[];
  isLoading: boolean;
  attention: GroupAttentionItem[];
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<GroupCompanyRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState<"NET_DESC" | "NET_ASC" | "NAME">("NET_DESC");
  const [lastFocus, setLastFocus] = useState<HTMLElement | null>(null);

  const statuses = useMemo(() => {
    const order = ["DUE", "OVERPAID", "SETTLED", "NOT_ENTERED", "UNREADABLE"];
    const present = new Set(rows.map((row) => row.status));
    return order.filter((value) => present.has(value as GroupCompanyRow["status"]));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matching = rows.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (!needle) return true;
      return `${row.code} ${row.name}`.toLowerCase().includes(needle);
    });
    return matching.sort((a, b) => {
      if (sort === "NAME") return a.name.localeCompare(b.name);
      // Rows with no figures have no position to rank; keep them at the bottom either way.
      const noA = NO_FIGURES.has(a.status);
      const noB = NO_FIGURES.has(b.status);
      if (noA !== noB) return noA ? 1 : -1;
      return sort === "NET_ASC" ? a.netPosition - b.netPosition : b.netPosition - a.netPosition;
    });
  }, [rows, q, status, sort]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const dirty = q !== "" || status !== "ALL";

  function openRow(row: GroupCompanyRow, origin?: HTMLElement | null) {
    setLastFocus(origin ?? null);
    setSelected(row);
    setDialogOpen(true);
  }

  function closeDialog(open: boolean) {
    setDialogOpen(open);
    if (open) return;
    // The row can be re-created while the dialog closes, so look it up after the commit
    // instead of holding a node that may already be detached.
    const companyId = selected?.companyId;
    requestAnimationFrame(() => {
      const target = companyId == null ? null : document.querySelector<HTMLElement>(`[data-company-row="${companyId}"]`);
      (target ?? lastFocus)?.focus();
    });
  }

  function rowKeyDown(event: KeyboardEvent, row: GroupCompanyRow) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openRow(row, event.currentTarget as HTMLElement);
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-primary/40 bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Company positions</h2>
            <p className="text-[11px] text-muted-foreground">
              Open a row for the VAT and withholding behind these columns.
            </p>
          </div>
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {formatNumber(total)} {total === 1 ? "company" : "companies"}
          </Badge>
        </header>

        <div aria-label="Company filters" className="border-b border-border/50 px-4 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
                placeholder="Company name or code…"
                aria-label="Search company"
                className="pl-8"
              />
            </div>

            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Status" className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All statuses</SelectItem>
                {statuses.map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setStatus("ALL");
                  setPage(1);
                }}
              >
                <X aria-hidden className="h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div className="hidden overflow-x-auto min-[1300px]:block">
          <table aria-label="Group tax position by company" className="w-full min-w-[900px] border-collapse text-sm">
            <caption className="sr-only">
              Sales net of VAT, deductible expenses, gross income, tax due, net position and status for every company in the group
            </caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-semibold" aria-sort={sort === "NAME" ? "ascending" : "none"}>
                  <button
                    type="button"
                    onClick={() => setSort(sort === "NAME" ? "NET_DESC" : "NAME")}
                    className="inline-flex items-center gap-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Company
                    {sort === "NAME" && <span aria-hidden>←</span>}
                  </button>
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">Regime</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Sales, net of VAT</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Deductible expenses</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Gross income</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Tax due</th>
                <th
                  scope="col"
                  className="px-4 py-2 text-right font-semibold"
                  aria-sort={sort === "NAME" ? "none" : sort === "NET_ASC" ? "ascending" : "descending"}
                >
                  <button
                    type="button"
                    onClick={() => setSort(sort === "NET_ASC" ? "NET_DESC" : "NET_ASC")}
                    className="inline-flex items-center gap-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Net position
                    {sort !== "NAME" && <span aria-hidden>{sort === "NET_ASC" ? "←" : "↓"}</span>}
                  </button>
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && total === 0
                ? Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="border-b last:border-0">
                      {Array.from({ length: COLUMNS }).map((__, cell) => (
                        <td key={cell} className="px-4 py-2.5">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : visible.map((row) => (
                    <tr
                      key={row.companyId}
                      data-company-row={row.companyId}
                      tabIndex={0}
                      aria-label={`Open ${row.name}`}
                      onClick={(event) => openRow(row, event.currentTarget)}
                      onKeyDown={(event) => rowKeyDown(event, row)}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <td className="max-w-[260px] px-4 py-2.5">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium" title={`${row.code} ${row.name}`}>
                            {row.name}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">{row.code}</span>
                        </div>
                      </td>
                      <td className="max-w-[150px] px-4 py-2.5">
                        <span className="block truncate text-xs" title={regimeLabel(row)}>
                          {regimeLabel(row)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(row, row.sales)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(row, row.expenses)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(row, row.grossIncome)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(row, row.taxDue)}</td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right font-medium tabular-nums",
                          row.status === "UNREADABLE" ? "text-muted-foreground" : netPositionClass(row.netPosition),
                        )}
                      >
                        {money(row, row.netPosition)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
              {!isLoading && total === 0 && (
                <tr>
                  <td colSpan={COLUMNS} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No company in the registry for this year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ul className="divide-y min-[1300px]:hidden">
          {isLoading && total === 0
            ? Array.from({ length: 4 }).map((_, index) => (
                <li key={`m-skeleton-${index}`} className="space-y-2 px-4 py-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                </li>
              ))
            : visible.map((row) => (
                <li
                  key={row.companyId}
                  data-company-row={row.companyId}
                  tabIndex={0}
                  aria-label={`Open ${row.name}`}
                  onClick={(event) => openRow(row, event.currentTarget)}
                  onKeyDown={(event) => rowKeyDown(event, row)}
                  className="cursor-pointer space-y-2 px-4 py-3 transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={`${row.code} ${row.name}`}>
                        {row.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground" title={regimeLabel(row)}>
                        {row.code} · {regimeLabel(row)}
                      </p>
                    </div>
                    <StatusBadge status={row.status} className="shrink-0" />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Sales, net of VAT</dt>
                      <dd className="tabular-nums">{money(row, row.sales)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Deductible expenses</dt>
                      <dd className="tabular-nums">{money(row, row.expenses)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Gross income</dt>
                      <dd className="tabular-nums">{money(row, row.grossIncome)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Net taxable</dt>
                      <dd className="tabular-nums">{money(row, row.netTaxableIncome)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Tax due</dt>
                      <dd className="tabular-nums">{money(row, row.taxDue)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Credits</dt>
                      <dd className="tabular-nums">{money(row, row.credits)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Net position</dt>
                      <dd
                        className={cn(
                          "font-medium tabular-nums",
                          row.status === "UNREADABLE" ? "text-muted-foreground" : netPositionClass(row.netPosition),
                        )}
                      >
                        {money(row, row.netPosition)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
          {!isLoading && total === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">No company in the registry for this year.</li>
          )}
        </ul>

        {total > 0 && (
          <div className="border-t px-4 py-3">
            <TablePager
              page={safePage}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </div>
        )}
      </section>

      <CompanyDetailDialog
        row={selected}
        attentionCount={selected ? countAttention(attention, selected) : 0}
        open={dialogOpen}
        onOpenChange={closeDialog}
      />
    </>
  );
}


