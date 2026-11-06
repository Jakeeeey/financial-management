"use client";

import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";

import { AccountsTable } from "./components/AccountsTable";
import { ArfTable } from "./components/ArfTable";
import { AuditTable } from "./components/AuditTable";
import { OptionCombobox, type ComboboxOption } from "./components/OptionCombobox";
import { useMasterlist } from "./hooks/useMasterlist";

const CSV_HEADER = [
  "Bank code",
  "Bank & branch",
  "Account no.",
  "Currency",
  "IFRS 9 category",
  "Linked GL",
  "Status",
  "Book balance",
  "Last reconciled (PHT)",
];

/** Bank Masterlist & Audit Logs (FSD 1.6): accounts, ARF findings and the PHT movement log. */
export function MasterlistModule() {
  const {
    accounts,
    visibleAccounts,
    findings,
    audit,
    auditTotal,
    page,
    pageCount,
    accountsPage,
    accountsPageCount,
    accountsTotal,
    findingsPage,
    findingsPageCount,
    findingsTotal,
    bankId,
    filters,
    notice,
    isLoading,
    error,
    setFilters,
    setPage,
    setBankId,
    setAccountsPage,
    setFindingsPage,
    refetch,
  } = useMasterlist();
  const [query, setQuery] = useState("");

  // Options come from the API, so they need a searchable picker rather than a fixed Select.
  const bankOptions: ComboboxOption[] = [
    { value: "ALL", label: "All accounts" },
    ...accounts.map((account) => ({
      value: String(account.bankId),
      label: `BA-${account.bankId} · ${account.bankName} · ${account.accountNumber}`,
      searchText: `${account.bankName} ${account.accountNumber} ${account.branch ?? ""}`,
      description: account.currency,
    })),
  ];

  async function copyCsv() {
    const lines = [
      CSV_HEADER.join(","),
      ...accounts.map((account) =>
        [
          `BA-${account.bankId}`,
          `${account.bankName} ${account.branch ?? ""}`.trim(),
          account.accountNumber,
          account.currency,
          account.ifrsCategory,
          account.glCode ?? "",
          account.status,
          account.bookBalance.toFixed(2),
          account.lastReconciledAt ?? "Never",
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(`${accounts.length} account(s) copied as CSV.`);
    } catch {
      toast.error("The browser blocked the clipboard.");
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Bank Masterlist &amp; Audit Logs (ARF)</h1>
          <p className="text-sm text-muted-foreground">
            Every account with its linked GL and book balance, open audit findings, and the movement log.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Refresh" onClick={refetch} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => void copyCsv()} disabled={accounts.length === 0}>
            <Copy className="mr-2 h-4 w-4" />
            Copy CSV
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load the masterlist</AlertTitle>
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert>
          <AlertTitle>Some data is not available yet</AlertTitle>
          <AlertDescription className="break-words">{notice}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">Bank masterlist</TabsTrigger>
          <TabsTrigger value="arf">ARF findings ({formatNumber(findings.length)})</TabsTrigger>
          <TabsTrigger value="audit">PHT movement log</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setFilters({ ...filters, q: query.trim() || undefined });
              }}
              placeholder="Search account no., holder or branch"
              className="w-full sm:w-[280px]"
            />
            <Select
              value={filters.status ?? "ALL"}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="DORMANT">Dormant</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.currency ?? "ALL"}
              onValueChange={(value) => setFilters({ ...filters, currency: value })}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All currencies</SelectItem>
                <SelectItem value="PHP">PHP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.reconciliation ?? "ALL"}
              onValueChange={(value) => setFilters({ ...filters, reconciliation: value })}
            >
              <SelectTrigger className="w-full sm:w-[190px]">
                <SelectValue placeholder="Reconciliation" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">Any reconciliation</SelectItem>
                <SelectItem value="RECONCILED">Reconciled at least once</SelectItem>
                <SelectItem value="UNRECONCILED">Never reconciled</SelectItem>
              </SelectContent>
            </Select>
            <OptionCombobox
              options={bankOptions}
              value={bankId}
              onChange={setBankId}
              placeholder="Bank account"
              searchPlaceholder="Search bank, account no. or branch"
              emptyLabel="No bank account found."
              className="w-full sm:w-[240px]"
            />
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setBankId("ALL");
                setFilters({});
              }}
            >
              Clear filters
            </Button>
          </div>

          <AccountsTable
            accounts={visibleAccounts}
            isLoading={isLoading}
            page={accountsPage}
            pageCount={accountsPageCount}
            total={accountsTotal}
            onPageChange={setAccountsPage}
          />
        </TabsContent>

        <TabsContent value="arf">
          <ArfTable
            findings={findings}
            page={findingsPage}
            pageCount={findingsPageCount}
            total={findingsTotal}
            onPageChange={setFindingsPage}
          />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTable rows={audit} page={page} pageCount={pageCount} total={auditTotal} onPage={setPage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
