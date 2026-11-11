"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2, RefreshCw , ClipboardList} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AccountsTable } from "./components/AccountsTable";
import { AccountDetailDialog } from "./components/AccountDetailDialog";
import { ArfFilters } from "./components/ArfFilters";
import { ArfTable } from "./components/ArfTable";
import { AuditFilters } from "./components/AuditFilters";
import { AuditTable } from "./components/AuditTable";
import { MasterlistFilters } from "./components/MasterlistFilters";
import type { ComboboxOption } from "./components/OptionCombobox";
import { useMasterlist } from "./hooks/useMasterlist";
import type { BankAccountV2 } from "./types";
import { downloadAccounts, downloadFindings, downloadLog } from "./utils/exportWorkbook";

type Tab = "accounts" | "arf" | "audit";

/** The download button names what it will actually contain, because each tab has its own columns. */
const DOWNLOAD_LABEL: Record<Tab, string> = {
  accounts: "Download masterlist",
  arf: "Download findings",
  audit: "Download log",
};

/** Bank Masterlist & Audit Logs (FSD 1.6): accounts, ARF findings and the PHT movement log. */
export function MasterlistModule() {
  const [tab, setTab] = useState<Tab>("accounts");
  const [isExporting, setIsExporting] = useState(false);
  const [openAccount, setOpenAccount] = useState<BankAccountV2 | null>(null);
  const {
    allAccounts,
    visibleAccounts,
    filteredFindings,
    audit,
    auditTotal,
    page,
    pageSize,
    pageCount,
    accountsPage,
    accountsPageSize,
    accountsPageCount,
    accountsTotal,
    findingsPage,
    findingsPageSize,
    findingsPageCount,
    findingsTotal,
    bankId,
    filters,
    arfFilters,
    logFilters,
    facets,
    accountTypeOptions,
    ifrsOptions,
    arfSubModules,
    notice,
    isLoading,
    error,
    setFilters,
    setPage,
    setBankId,
    setAccountsPage,
    setAccountsPageSize,
    setFindingsPage,
    setFindingsPageSize,
    setAuditPageSize,
    setArfFilters,
    setLogFilters,
    allAuditRows,
    refetch,
  } = useMasterlist();

  // Options come from the unfiltered set, so a chosen value never disappears from its own picker.
  const bankOptions: ComboboxOption[] = [
    { value: "ALL", label: "All accounts" },
    ...allAccounts.map((account) => ({
      value: String(account.bankId),
      label: `BA-${account.bankId} · ${account.bankName} · ${account.accountNumber}`,
      searchText: `${account.bankName} ${account.accountNumber} ${account.branch ?? ""}`,
      description: account.currency,
    })),
  ];

  /** Each tab downloads its own sheet, with the filters that tab is showing. */
  async function download() {
    setIsExporting(true);
    try {
      if (tab === "accounts") {
        if (!visibleAccounts.length) {
          toast.warning("No account matches these filters.");
          return;
        }
        downloadAccounts(visibleAccounts);
        toast.success(`${visibleAccounts.length} account(s) downloaded.`);
      } else if (tab === "arf") {
        if (!filteredFindings.length) {
          toast.warning("No finding matches these filters.");
          return;
        }
        downloadFindings(filteredFindings);
        toast.success(`${filteredFindings.length} finding(s) downloaded.`);
      } else {
        const rows = await allAuditRows();
        if (!rows.length) {
          toast.warning("No log entry matches these filters.");
          return;
        }
        downloadLog(rows);
        toast.success(`${rows.length} log entr${rows.length === 1 ? "y" : "ies"} downloaded.`);
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The workbook could not be generated.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ClipboardList className="size-5" />
            </div>
            <h1 className="text-xl font-semibold sm:text-2xl">Bank Masterlist &amp; Audit Logs (ARF)</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Every account with its linked GL and book balance, open audit findings, and the movement log.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Refresh" onClick={refetch} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => void download()} disabled={isExporting || isLoading}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            {DOWNLOAD_LABEL[tab]}
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

      <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts" className="min-h-11 md:min-h-0">
            Bank Masterlist
          </TabsTrigger>
          <TabsTrigger value="arf" className="min-h-11 md:min-h-0">
            ARF Findings
          </TabsTrigger>
          <TabsTrigger value="audit" className="min-h-11 md:min-h-0">
            Movement Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <AccountsTable
            accounts={visibleAccounts}
            isLoading={isLoading}
            page={accountsPage}
            pageCount={accountsPageCount}
            total={accountsTotal}
            pageSize={accountsPageSize}
            onPageChange={setAccountsPage}
            onPageSizeChange={setAccountsPageSize}
            onOpenAccount={setOpenAccount}
            filters={
              <MasterlistFilters
                filters={filters}
                bankId={bankId}
                bankOptions={bankOptions}
                accountTypeOptions={accountTypeOptions}
                ifrsOptions={ifrsOptions}
                onChange={setFilters}
                onBankChange={setBankId}
                onClear={() => {
                  setBankId("ALL");
                  setFilters({});
                }}
              />
            }
          />
        </TabsContent>

        <TabsContent value="arf">
          <ArfTable
            findings={filteredFindings}
            page={findingsPage}
            pageCount={findingsPageCount}
            total={findingsTotal}
            pageSize={findingsPageSize}
            onPageChange={setFindingsPage}
            onPageSizeChange={setFindingsPageSize}
            filters={
              <ArfFilters
                filters={arfFilters}
                subModules={arfSubModules}
                onChange={setArfFilters}
              />
            }
          />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTable
            rows={audit}
            page={page}
            pageCount={pageCount}
            total={auditTotal}
            pageSize={pageSize}
            onPage={setPage}
            onPageSizeChange={setAuditPageSize}
            emptyLabel={
              logFilters.q || logFilters.module !== "ALL" || logFilters.pht !== "ALL" || logFilters.from || logFilters.to
                ? "No log entry matches these filters."
                : "The movement log has no entry yet."
            }
            filters={
              <AuditFilters
                filters={logFilters}
                modules={facets.modules}
                users={facets.users}
                onChange={setLogFilters}
              />
            }
          />
        </TabsContent>
      </Tabs>

      <AccountDetailDialog account={openAccount} onOpenChange={(open) => !open && setOpenAccount(null)} />
    </div>
  );
}
