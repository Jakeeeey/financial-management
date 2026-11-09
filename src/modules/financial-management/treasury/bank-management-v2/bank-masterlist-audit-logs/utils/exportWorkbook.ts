"use client";

import * as XLSX from "xlsx";

import { statusLabel } from "../constants";
import { phtDisplayStamp, toPhtDateString } from "../pht";
import type { ArfFinding, AuditLogRow, BankAccountV2 } from "../types";

type Cell = string | number | null;

/** One sheet, one file: `XLSX.writeFile` triggers the browser download. */
function writeSheet(filename: string, sheetName: string, header: string[], rows: Cell[][], widths: number[]) {
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, filename);
}

/** "Bank management masterlist 2026-11-09.xlsx" — the date keeps repeat downloads apart. */
function fileName(label: string): string {
  return `Bank management ${label} ${toPhtDateString(new Date().toISOString())}.xlsx`;
}

export function downloadAccounts(accounts: BankAccountV2[]) {
  writeSheet(
    fileName("masterlist"),
    "Masterlist",
    [
      "Bank code",
      "Bank & branch",
      "Account no.",
      "Account holder",
      "Account type",
      "Currency",
      "IFRS 9 category",
      "Linked GL",
      "Status",
      "Book balance",
      "Last reconciled (PHT)",
    ],
    accounts.map((account) => [
      `BA-${account.bankId}`,
      `${account.bankName} ${account.branch ?? ""}`.trim(),
      account.accountNumber,
      account.accountName ?? "",
      account.accountType ?? "",
      account.currency,
      account.ifrsCategory,
      account.glCode ?? "",
      statusLabel(account.status),
      account.bookBalance,
      account.lastReconciledAt ? toPhtDateString(account.lastReconciledAt) : "Never",
    ]),
    [10, 34, 20, 26, 14, 10, 18, 14, 12, 16, 20],
  );
}

export function downloadFindings(findings: ArfFinding[]) {
  writeSheet(
    fileName("ARF findings"),
    "ARF findings",
    ["Severity", "ARF sub-module", "Finding", "Detail", "Reference", "Occurred (PHT)", "Action"],
    findings.map((finding) => [
      finding.severity,
      finding.subModule,
      finding.title,
      finding.detail,
      finding.reference ?? "",
      finding.occurredAt ? toPhtDateString(finding.occurredAt) : "",
      finding.goTo ? "Open module" : "No action",
    ]),
    [12, 22, 34, 60, 22, 18, 22],
  );
}

export function downloadLog(rows: AuditLogRow[]) {
  writeSheet(
    fileName("movement log"),
    "PHT movement log",
    ["Stored timestamp", "PHT reading", "Module", "Action", "Detail", "Reference", "User", "Legacy UTC"],
    rows.map((row) => [
      row.legacyUtcAt ?? row.occurredAt,
      phtDisplayStamp(row.occurredAt),
      row.module,
      row.action,
      row.detail ?? "",
      row.reference ?? "",
      row.actorName ?? "System",
      row.legacyUtcAt ? "Yes" : "No",
    ]),
    [22, 20, 18, 34, 50, 22, 18, 12],
  );
}
