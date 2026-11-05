import assert from "node:assert/strict";
import test from "node:test";
import type { JournalEntry, JournalEntryGroup } from "../types";
import { createDefaultFilterState } from "../utils/filter-state";
import { buildJournalExportData } from "./export.service";
import { filterJournalEntries, groupJournalEntries } from "./journal-entry.helpers";
import { getJournalAuditEvents } from "./journal-entry-audit";
import type { AjeAuditEvent } from "../../adjusting-journal-entries/types";
import { auditEventSummary } from "../../adjusting-journal-entries/components/formatters";

function line(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    jeGroupCounter: 1,
    jeNo: "SI-001",
    sourceModule: "Sales Invoice",
    transactionRef: "REF-001",
    transactionDate: "2026-10-20",
    description: "Journal description",
    status: "Posted",
    division: "1",
    divisionName: "Division One",
    department: "2",
    departmentName: "Department Two",
    creator: "Creator",
    coaId: 10,
    accountNumber: "1000",
    accountTitle: "Cash",
    debit: 100,
    credit: 0,
    branchId: null,
    branchName: null,
    ...overrides,
  };
}

function group(jeNo: string, id: number, amount: number): JournalEntryGroup {
  return groupJournalEntries([
    line({ jeNo, jeGroupCounter: id, sourceModule: id === 1 ? "Sales Invoice" : "Adjusting Entry", debit: amount }),
    line({ jeNo, jeGroupCounter: id, sourceModule: id === 1 ? "Sales Invoice" : "Adjusting Entry", debit: 0, credit: amount, accountNumber: "2000" }),
  ])[0];
}

const filters = { ...createDefaultFilterState(), startDate: "2026-10-01", endDate: "2026-10-31" };

test("flat filtering includes posted AJEs and preserves regular journal statuses", () => {
  const rows = [
    line(),
    line({ jeNo: "AJE-002", sourceModule: "Adjusting Entry" }),
    line({ jeNo: "SI-003", status: "Unposted" }),
    ...["Draft", "For Revision", "Submitted", "Approved", "Rejected", "Failed", "Cancelled", "Voided"].map(status =>
      line({ jeNo: `AJE-${status}`, sourceModule: "Adjusting Entry", status })),
  ];
  assert.deepEqual(filterJournalEntries(rows, filters).map(row => row.jeNo), ["SI-001", "AJE-002", "SI-003"]);
  assert.deepEqual(filterJournalEntries(rows, { ...filters, sourceModule: "Adjusting Entry", status: "Posted" }).map(row => row.jeNo), ["AJE-002"]);
});

test("AJEs follow their own date, search, account and organizational criteria", () => {
  const adjustment = line({ jeNo: "AJE-002", sourceModule: "Adjusting Entry" });
  const rows = [line({ transactionDate: "2026-09-20" }), adjustment];
  assert.deepEqual(filterJournalEntries(rows, filters), [adjustment]);
  assert.deepEqual(filterJournalEntries(rows, { ...filters, search: "AJE-002", division: "1", department: "2", accountNumber: "1000" }), [adjustment]);
  assert.deepEqual(filterJournalEntries(rows, { ...filters, division: "Division One", department: "Department Two" }), [adjustment]);
  assert.deepEqual(filterJournalEntries(rows, { ...filters, branch: "9" }), []);
  assert.deepEqual(filterJournalEntries(rows, { ...filters, department: "9" }), []);
  assert.deepEqual(filterJournalEntries(rows, { ...filters, accountNumber: "9999" }), []);
});

test("report exports count each journal once and preserve signed reversal amounts", () => {
  const original = { ...group("SI-001", 1, 100), adjustedTotalDebit: 120, adjustedTotalCredit: 120 };
  const groups = [original, group("AJE-002", 2, 20), group("AJE-003", 3, 7), group("AJE-004", 4, -5)];
  const rows = buildJournalExportData(groups);
  assert.deepEqual(rows.filter(row => row.kind === "subtotal").map(row => [row.cells[2], row.cells[5], row.cells[6]]), [
    ["SI-001", 100, 100], ["AJE-002", 20, 20], ["AJE-003", 7, 7], ["AJE-004", -5, -5],
  ]);
  assert.deepEqual(rows.at(-1)?.cells.slice(5), [122, 122, 0]);
  assert.equal(rows.filter(row => row.kind === "detail" && row.cells[2] === "AJE-002").length, 1);
  assert.ok(rows.some(row => row.cells[1] === "Adjusting Entry"));
  assert.ok(rows.some(row => row.kind === "detail" && row.cells[5] === -5));
});

test("individual exports include the selected journal only", () => {
  const rows = buildJournalExportData([group("SI-001", 1, 100)]);
  assert.equal(rows.length, 4);
  assert.equal(rows.some(row => row.cells.some(cell => String(cell).startsWith("AJE-"))), false);
  assert.deepEqual(rows.at(-1)?.cells.slice(5), [100, 100, 0]);
});

test("empty exports preserve zero totals", () => {
  assert.deepEqual(buildJournalExportData([]).at(-1)?.cells.slice(5), [0, 0, 0]);
});

function auditEvent(id: number, overrides: Partial<AjeAuditEvent> = {}): AjeAuditEvent {
  return {
    id, entryId: 2, journalNumber: "AJE-002", currentEntryAvailable: true, currentReference: "REF-002", originalJournalNumber: null, originalReference: null,
    actorUserId: 1, actorName: "Reviewer", action: "Created", status: "Posted",
    occurredAt: "2026-10-20T13:48:00", reason: null, changes: [], currentTotalDebit: 20, currentTotalCredit: 20,
    ...overrides,
  };
}

test("audit history loads every page and excludes other journals matched by search", async t => {
  const requests: string[] = [];
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost:3000");
    requests.push(url.searchParams.get("page") || "");
    assert.equal(url.searchParams.get("search"), "AJE-002");
    assert.equal(init?.signal, controller.signal);
    const content = url.searchParams.get("page") === "0"
      ? [auditEvent(3, { action: "Posted", occurredAt: "2026-10-22T13:45:00" }), auditEvent(8, { journalNumber: "AJE-002-OTHER" })]
      : [auditEvent(2, { action: "Edited" }), auditEvent(1)];
    return new Response(JSON.stringify({ content, page: { totalPages: 2, totalElements: 4 } }));
  });
  const events = await getJournalAuditEvents("AJE-002", controller.signal);
  assert.deepEqual(requests, ["0", "1"]);
  assert.deepEqual(events.map(event => [event.id, event.action]), [[1, "Created"], [2, "Edited"], [3, "Posted"]]);
});

test("audit failures do not return partial history or an empty success", async t => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const page = new URL(String(input), "http://localhost:3000").searchParams.get("page");
    return page === "0"
      ? new Response(JSON.stringify({ content: [auditEvent(1)], totalPages: 2, totalElements: 2 }))
      : new Response(JSON.stringify({ message: "Audit service unavailable" }), { status: 503 });
  });
  await assert.rejects(getJournalAuditEvents("AJE-002"), /Audit service unavailable/);
});

test("audit summaries match Posting and preserve recorded reasons", () => {
  assert.equal(auditEventSummary(auditEvent(1)), "Adjusting entry created");
  assert.equal(auditEventSummary(auditEvent(2, { action: "Posted" })), "Posted to the General Ledger");
  assert.equal(auditEventSummary(auditEvent(3, { action: "Edited", reason: "Corrected reference" })), "Corrected reference");
});

import { journalEntryType } from "../utils/entry-type";
import { parseJournalEntryUrlState, serializeJournalEntryUrlState } from "../utils/filter-state";
import { sourceReferenceHref } from "../utils/source-reference";

test("entry types filter flat exports by actual source category and combine with source module", () => {
  const rows = [line(), line({ sourceModule: "Collection" }), line({ sourceModule: "Disbursement" }), line({ sourceModule: "Adjusting Entry" })];
  for (const [entryType, source] of [["Sales", "Sales Invoice"], ["Collection", "Collection"], ["Disbursement", "Disbursement"], ["Adjustment", "Adjusting Entry"]]) {
    assert.equal(journalEntryType(source), entryType);
    assert.deepEqual(filterJournalEntries(rows, { ...filters, entryType }).map(row => row.sourceModule), [source]);
  }
  assert.deepEqual(filterJournalEntries(rows, { ...filters, entryType: "Sales", sourceModule: "Collection" }), []);
  const selected = { ...filters, entryType: "Adjustment", status: "Posted" };
  assert.equal(parseJournalEntryUrlState(new URLSearchParams(serializeJournalEntryUrlState(selected, 2, 20))).filters.entryType, "Adjustment");
  assert.equal(parseJournalEntryUrlState(new URLSearchParams("showPostedOnly=true")).filters.status, "Posted");
});

test("source navigation only permits resolved numeric records on known internal routes", () => {
  assert.equal(sourceReferenceHref({ type: "Disbursement", id: 7, reference: "NT-007291", state: "RESOLVED", message: null }), "/fm/treasury/cash-issuance/ledger?sourceId=7");
  for (const type of ["Disbursement", "Sales Invoice", "Collection", "Adjusting Entry"]) {
    assert.match(sourceReferenceHref({ type, id: 7, reference: "REF", state: "RESOLVED", message: null })!, /^\/fm\/.*\?sourceId=7$/);
  }
  for (const state of ["MISSING", "AMBIGUOUS", "FORBIDDEN", "UNSUPPORTED"]) assert.equal(sourceReferenceHref({ type: "Disbursement", id: 7, reference: "REF", state, message: null }), null);
  assert.equal(sourceReferenceHref({ type: "https://outside.invalid", id: 7, reference: "REF", state: "RESOLVED", message: null }), null);
  assert.equal(sourceReferenceHref({ type: "Disbursement", id: -1, reference: "REF", state: "RESOLVED", message: null }), null);
});


import { collectionReference } from "../utils/collection-reference";

test("CP numbers use an unambiguous Collection source reference without inferring from the JE", () => {
  const collection = groupJournalEntries([
    line({ jeNo: "CR-CP-005834", sourceModule: "Collection", transactionRef: " CP-005834 " }),
    line({ jeNo: "CR-CP-005834", sourceModule: "Collection", transactionRef: "CP-005834", debit: 0, credit: 100 }),
  ])[0];
  assert.equal(collectionReference(collection), "CP-005834");
  assert.equal(collectionReference({ ...collection, sourceModule: "Disbursement" }), null);
  assert.equal(collectionReference({ ...collection, entries: collection.entries.map(entry => ({ ...entry, transactionRef: "" })) }), null);
  assert.equal(collectionReference({ ...collection, entries: [...collection.entries, { ...collection.entries[0], transactionRef: "CP-OTHER" }] }), null);
});

test("collection exports retain CP and line findings while every amount and total stays unchanged", () => {
  const entries = [
    line({ sourceModule: "Collection", jeNo: "CR-CP-005834", transactionRef: "CP-005834", accountTitle: "Dated Check", debit: 11877.88, credit: 0 }),
    line({ sourceModule: "Collection", jeNo: "CR-CP-005834", transactionRef: "CP-005834", accountTitle: "Due from Employees", debit: 367.36, credit: 0 }),
    line({ sourceModule: "Collection", jeNo: "CR-CP-005834", transactionRef: "CP-005834", accountTitle: "Accounts Receivable", debit: 0, credit: 11877.88 }),
    line({ sourceModule: "Collection", jeNo: "CR-CP-005834", transactionRef: "CP-005834", accountTitle: "Accounts Receivable", debit: 0, credit: 367.36 }),
  ];
  const original = groupJournalEntries(entries)[0];
  const labelled = { ...original, entries: original.entries.map((entry, index) => ({ ...entry, description: index === 1 ? "Collection Reference: CP-005834 | Adjustment: Due To Unauthorized Deduction" : index === 3 ? "Collection Reference: CP-005834 | Adjustment offset: Due To Unauthorized Deduction" : "Collection Reference: CP-005834" })) };
  const before = buildJournalExportData([original]);
  const after = buildJournalExportData([labelled]);
  assert.deepEqual(after.map(row => row.cells.slice(5)), before.map(row => row.cells.slice(5)));
  assert.equal(after[0].cells[2], "CR-CP-005834\nCP#: CP-005834");
  assert.equal(after[1].cells[4], labelled.entries[1].description);
  assert.equal(after[3].cells[4], labelled.entries[3].description);
  assert.deepEqual(after.at(-1)?.cells.slice(5), [12245.24, 12245.24, 0]);
});
