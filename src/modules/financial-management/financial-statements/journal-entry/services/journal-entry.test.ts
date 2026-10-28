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
