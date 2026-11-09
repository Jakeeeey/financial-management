"use client";

import { Fragment } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { TablePager } from "./TablePager";
import { classLabel, classTone, statusTone, toneClass } from "../constants";
import type { DormancyAccount } from "../types";

const COLUMNS = 8;

type Props = {
  accounts: DormancyAccount[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  isLoading: boolean;
  isSaving: boolean;
  onPageChange: (page: number) => void;
  onOpen: (account: DormancyAccount) => void;
  onReclassify: (account: DormancyAccount) => void;
  onEscheat: (account: DormancyAccount) => void;
  /** Filter band rendered inside the scan card, like every other V2 table. */
  filters: ReactNode;
};

type Action = { label: string; run: (account: DormancyAccount) => void; danger?: boolean; primary?: boolean };

function actionsFor(account: DormancyAccount, props: Props): Action[] {
  if (account.status === "CLOSED") return [];
  if (account.status === "DORMANT" && account.classification === "ESCHEAT_ELIGIBLE") {
    return [{ label: "Escheat (Act 3936)", run: props.onEscheat, danger: true }];
  }
  if (account.status === "ACTIVE" && account.classification === "DORMANT_ELIGIBLE") {
    return [{ label: "Reclassify to 201800", run: props.onReclassify, primary: true }];
  }
  return [];
}

function ActivityCell({ account }: { account: DormancyAccount }) {
  return (
    <div className="min-w-0">
      <p className="truncate" title={account.lastCustomerActivity ?? undefined}>
        {account.lastCustomerActivity ?? "No customer activity"}
      </p>
      <p className="truncate text-xs text-muted-foreground" title={account.lastActivitySource ?? undefined}>
        {account.lastActivitySource ?? "Counted from onboarding"}
      </p>
    </div>
  );
}

function RowActions({ account, props }: { account: DormancyAccount; props: Props }) {
  const actions = actionsFor(account, props);
  if (actions.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {account.status === "CLOSED" ? `Closed ${account.closedAt ?? ""}`.trim() : "No action"}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
      {actions.map((action) => (
        <Button
          key={action.label}
          size="sm"
          variant={action.primary ? "default" : action.danger ? "destructive" : "outline"}
          disabled={props.isSaving}
          onClick={() => action.run(account)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function DormancyTable(props: Props) {
  const { accounts, total, page, pageCount, pageSize, isLoading, onPageChange, onOpen, filters } = props;

  return (
    <section
      aria-label="Inactivity and dormancy scan"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-teal-500/70 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Inactivity &amp; dormancy scan</h2>
          <p className="text-xs text-muted-foreground">
            Bank-initiated memos do not count as customer activity.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {formatNumber(total)} accounts
        </Badge>
      </header>

      {filters}

      {isLoading ? (
        <div className="space-y-2 px-4 pb-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          No account matches these filters.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[190px]">Account</TableHead>
                  <TableHead className="w-[220px]">Bank &amp; branch</TableHead>
                  <TableHead className="w-[130px] text-right">Book balance</TableHead>
                  <TableHead className="w-[170px]">Last customer activity</TableHead>
                  <TableHead className="w-[110px] text-right">Months inactive</TableHead>
                  <TableHead className="w-[150px]">Classification</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[190px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow
                    key={account.bankId}
                    tabIndex={0}
                    aria-label={`Open account ${account.accountNumber}`}
                    className="cursor-pointer"
                    onClick={() => onOpen(account)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(account);
                      }
                    }}
                  >
                    <TableCell className="max-w-[190px] truncate font-medium" title={account.accountNumber}>
                      {account.accountNumber}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="min-w-0">
                        <p className="truncate" title={account.bankName}>
                          {account.bankName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={account.branch ?? undefined}>
                          {account.branch ?? "No branch"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-right">{formatCurrency(account.bookBalance)}</TableCell>
                    <TableCell>
                      <ActivityCell account={account} />
                    </TableCell>
                    <TableCell className="tabular-nums text-right">{formatNumber(account.monthsInactive)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold ${toneClass(classTone(account.classification))}`}
                      >
                        {classLabel(account.classification)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold ${toneClass(statusTone(account.status))}`}
                      >
                        {account.status === "ACTIVE" ? "Active" : account.status === "DORMANT" ? "Dormant" : "Closed"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RowActions account={account} props={props} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border xl:hidden">
            {accounts.map((account) => (
              <Fragment key={account.bankId}>
                <li className="space-y-2 p-4">
                  <button
                    type="button"
                    className="w-full text-left"
                    aria-label={`Open account ${account.accountNumber}`}
                    onClick={() => onOpen(account)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium" title={account.accountNumber}>
                          {account.accountNumber}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={account.bankName}>
                          {account.bankName}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[11px] font-semibold ${toneClass(classTone(account.classification))}`}
                      >
                        {classLabel(account.classification)}
                      </Badge>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <dt>Book balance</dt>
                        <dd className="tabular-nums text-foreground">{formatCurrency(account.bookBalance)}</dd>
                      </div>
                      <div>
                        <dt>Months inactive</dt>
                        <dd className="tabular-nums text-foreground">{formatNumber(account.monthsInactive)}</dd>
                      </div>
                    </dl>
                  </button>
                  <RowActions account={account} props={props} />
                </li>
              </Fragment>
            ))}
          </ul>
        </>
      )}

      <TablePager
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        isLoading={isLoading}
        className="border-t border-border/50 px-4 py-3"
      />
    </section>
  );
}

export { COLUMNS as DORMANCY_COLUMNS };
