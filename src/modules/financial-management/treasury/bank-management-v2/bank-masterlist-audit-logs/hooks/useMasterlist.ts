"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAccounts, fetchAudit, fetchFindings, type AccountsFilter } from "../providers/masterlistApi";
import type { ArfFinding, AuditLogRow, BankAccountV2 } from "../types";
import { ALL, LIST_PAGE_SIZE } from "../constants";

const PAGE_SIZE = LIST_PAGE_SIZE;

export type ArfFilters = { severity: string; subModule: string; q: string };
export type LogFilters = { module: string; user: string; pht: string; from: string; to: string; q: string };

export const EMPTY_ARF_FILTERS: ArfFilters = { severity: ALL, subModule: ALL, q: "" };
export const EMPTY_LOG_FILTERS: LogFilters = { module: ALL, user: ALL, pht: ALL, from: "", to: "", q: "" };

/** Loads the three masterlist tabs: account list, ARF findings and the PHT movement log. */
export function useMasterlist() {
  const [accounts, setAccounts] = useState<BankAccountV2[]>([]);
  const [allAccounts, setAllAccounts] = useState<BankAccountV2[]>([]);
  const [findings, setFindings] = useState<ArfFinding[]>([]);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [facets, setFacets] = useState<{ modules: string[]; users: string[] }>({ modules: [], users: [] });
  const [page, setPage] = useState(1);
  const [filters, setFiltersState] = useState<AccountsFilter>({});
  const [bankId, setBankIdState] = useState(ALL);
  const [arfFilters, setArfFiltersState] = useState<ArfFilters>(EMPTY_ARF_FILTERS);
  const [logFilters, setLogFiltersState] = useState<LogFilters>(EMPTY_LOG_FILTERS);
  const [accountsPage, setAccountsPage] = useState(1);
  const [findingsPage, setFindingsPage] = useState(1);
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async (next: AccountsFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAccounts(next);
      setAccounts(result.accounts);
      setNotice(result.notice);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the masterlist.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter options must come from the unfiltered set, or narrowing hides the value that produced it.
  const loadAllAccounts = useCallback(async () => {
    try {
      const result = await fetchAccounts({});
      setAllAccounts(result.accounts);
    } catch {
      // The filtered load already surfaces the error; the pickers just stay empty.
    }
  }, []);

  const loadFindings = useCallback(async () => {
    try {
      const result = await fetchFindings();
      setFindings(result.findings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the ARF findings.");
    }
  }, []);

  const loadAudit = useCallback(async (nextPage: number, next: LogFilters) => {
    try {
      const result = await fetchAudit({
        module: next.module,
        user: next.user,
        pht: next.pht,
        q: next.q.trim() || undefined,
        from: next.from || undefined,
        to: next.to || undefined,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setAudit(result.rows);
      setAuditTotal(result.total);
      setFacets(result.facets);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the movement log.");
    }
  }, []);

  useEffect(() => {
    void loadAccounts(filters);
  }, [filters, loadAccounts]);

  useEffect(() => {
    void loadAllAccounts();
  }, [loadAllAccounts]);

  useEffect(() => {
    void loadFindings();
  }, [loadFindings]);

  useEffect(() => {
    void loadAudit(page, logFilters);
  }, [page, logFilters, loadAudit]);

  // Narrowing can empty the current page, so the pager rewinds with the filter that did it.
  const setFilters = useCallback((next: AccountsFilter) => {
    setFiltersState(next);
    setAccountsPage(1);
  }, []);

  const setBankId = useCallback((next: string) => {
    setBankIdState(next);
    setAccountsPage(1);
  }, []);

  const setLogFilters = useCallback((next: LogFilters) => {
    setLogFiltersState(next);
    setPage(1);
  }, []);

  const setArfFilters = useCallback((next: ArfFilters) => {
    setArfFiltersState(next);
    setFindingsPage(1);
  }, []);

  /**
   * Every log row matching the current filters, for the workbook download — the table itself
   * only holds one server page. Pages of 100 until a short page; the route caps pageSize at 100.
   */
  const allAuditRows = useCallback(async (): Promise<AuditLogRow[]> => {
    const collected: AuditLogRow[] = [];
    for (let pageNumber = 1; pageNumber <= 50; pageNumber += 1) {
      const result = await fetchAudit({
        module: logFilters.module,
        user: logFilters.user,
        pht: logFilters.pht,
        q: logFilters.q.trim() || undefined,
        from: logFilters.from || undefined,
        to: logFilters.to || undefined,
        page: pageNumber,
        pageSize: 100,
      });
      collected.push(...result.rows);
      if (result.rows.length < 100) break;
    }
    return collected;
  }, [logFilters]);

  const visibleAccounts =
    bankId === ALL ? accounts : accounts.filter((account) => String(account.bankId) === bankId);

  const filteredFindings = useMemo(() => {
    const needle = arfFilters.q.trim().toLowerCase();
    return findings.filter((finding) => {
      if (arfFilters.severity !== ALL && finding.severity !== arfFilters.severity) return false;
      if (arfFilters.subModule !== ALL && finding.subModule !== arfFilters.subModule) return false;
      if (!needle) return true;
      return (
        finding.title.toLowerCase().includes(needle) ||
        finding.detail.toLowerCase().includes(needle) ||
        (finding.reference ?? "").toLowerCase().includes(needle)
      );
    });
  }, [findings, arfFilters]);

  const accountsPageCount = Math.max(1, Math.ceil(visibleAccounts.length / LIST_PAGE_SIZE));
  const findingsPageCount = Math.max(1, Math.ceil(filteredFindings.length / LIST_PAGE_SIZE));

  const counts = {
    critical: findings.filter((finding) => finding.severity === "CRITICAL").length,
    high: findings.filter((finding) => finding.severity === "HIGH").length,
    medium: findings.filter((finding) => finding.severity === "MEDIUM").length,
  };

  // Option lists, read from the unfiltered account set so a chosen value never disappears.
  const accountTypeOptions = useMemo(
    () => [...new Set(allAccounts.map((account) => account.accountType).filter((value): value is string => !!value))].sort(),
    [allAccounts],
  );
  const ifrsOptions = useMemo(
    () => [...new Set(allAccounts.map((account) => account.ifrsCategory).filter(Boolean))].sort(),
    [allAccounts],
  );
  const arfSubModules = useMemo(
    () => [...new Set(findings.map((finding) => finding.subModule).filter(Boolean))].sort(),
    [findings],
  );

  return {
    accounts,
    allAccounts,
    visibleAccounts,
    findings,
    filteredFindings,
    audit,
    auditTotal,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(auditTotal / PAGE_SIZE)),
    // Clamped: a refetch can shrink the list under a page number the user already picked.
    accountsPage: Math.min(accountsPage, accountsPageCount),
    accountsPageCount,
    accountsTotal: visibleAccounts.length,
    findingsPage: Math.min(findingsPage, findingsPageCount),
    findingsPageCount,
    findingsTotal: filteredFindings.length,
    bankId,
    counts,
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
    setFindingsPage,
    setArfFilters,
    setLogFilters,
    allAuditRows,
    refetch: () => {
      void loadAccounts(filters);
      void loadAllAccounts();
      void loadFindings();
      void loadAudit(page, logFilters);
    },
  };
}
