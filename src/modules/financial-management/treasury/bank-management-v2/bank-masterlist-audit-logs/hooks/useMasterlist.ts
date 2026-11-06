"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchAccounts, fetchAudit, fetchFindings, type AccountsFilter } from "../providers/masterlistApi";
import type { ArfFinding, AuditLogRow, BankAccountV2 } from "../types";
import { ALL, LIST_PAGE_SIZE } from "../constants";

const PAGE_SIZE = 20;

/** Loads the three masterlist tabs: account list, ARF findings and the PHT movement log. */
export function useMasterlist() {
  const [accounts, setAccounts] = useState<BankAccountV2[]>([]);
  const [findings, setFindings] = useState<ArfFinding[]>([]);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFiltersState] = useState<AccountsFilter>({});
  const [bankId, setBankIdState] = useState(ALL);
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

  const loadFindings = useCallback(async () => {
    try {
      const result = await fetchFindings();
      setFindings(result.findings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the ARF findings.");
    }
  }, []);

  const loadAudit = useCallback(async (nextPage: number) => {
    try {
      const result = await fetchAudit({ page: nextPage, pageSize: PAGE_SIZE });
      setAudit(result.rows);
      setAuditTotal(result.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the movement log.");
    }
  }, []);

  useEffect(() => {
    void loadAccounts(filters);
  }, [filters, loadAccounts]);

  useEffect(() => {
    void loadFindings();
  }, [loadFindings]);

  useEffect(() => {
    void loadAudit(page);
  }, [page, loadAudit]);

  // Narrowing can empty the current page, so the pager rewinds with the filter that did it.
  const setFilters = useCallback((next: AccountsFilter) => {
    setFiltersState(next);
    setAccountsPage(1);
  }, []);

  const setBankId = useCallback((next: string) => {
    setBankIdState(next);
    setAccountsPage(1);
  }, []);

  const visibleAccounts =
    bankId === ALL ? accounts : accounts.filter((account) => String(account.bankId) === bankId);
  const accountsPageCount = Math.max(1, Math.ceil(visibleAccounts.length / LIST_PAGE_SIZE));
  const findingsPageCount = Math.max(1, Math.ceil(findings.length / LIST_PAGE_SIZE));

  const counts = {
    critical: findings.filter((finding) => finding.severity === "CRITICAL").length,
    high: findings.filter((finding) => finding.severity === "HIGH").length,
    medium: findings.filter((finding) => finding.severity === "MEDIUM").length,
  };

  return {
    accounts,
    visibleAccounts,
    findings,
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
    findingsTotal: findings.length,
    bankId,
    counts,
    filters,
    notice,
    isLoading,
    error,
    setFilters,
    setPage,
    setBankId,
    setAccountsPage,
    setFindingsPage,
    refetch: () => void loadAccounts(filters),
  };
}
