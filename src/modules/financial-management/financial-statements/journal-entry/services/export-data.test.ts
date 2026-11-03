import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import type { JournalEntry } from "../types";
import { groupJournalEntries } from "./journal-entry.helpers";
import { loadJournalExportGroups, EXPORT_BATCH_SIZE } from "./export-data";
import { buildJournalExportData, generateJournalExcel, generateJournalPdf } from "./export.service";

function group(id = 1) {
  const line: JournalEntry = {
    jeGroupCounter: id, jeNo: `CR-${id}`, sourceModule: "Collection", transactionRef: `CP-${id}`,
    transactionDate: "2026-10-20", description: "Collection adjustment", status: "Posted",
    division: null, divisionName: null, department: null, departmentName: null, creator: null,
    accountTitle: "Cash", debit: 100.04, credit: 0,
  };
  return groupJournalEntries([line, { ...line, description: "Shortage offset", debit: 0, credit: 100 }])[0];
}

function payload(data: unknown[], total = data.length, page = 0) {
  return { data, metadata: { totalGroups: total, totalPages: Math.ceil(total / EXPORT_BATCH_SIZE), currentPage: page, pageSize: EXPORT_BATCH_SIZE } };
}

test("server batches preserve complete journals, supplied order and rounded totals", async () => {
  const source = Array.from({ length: 501 }, (_, index) => group(index + 1));
  const calls: number[] = [];
  const result = await loadJournalExportGroups(async (page, size) => {
    calls.push(page);
    assert.equal(size, 500);
    return payload(source.slice(page * size, (page + 1) * size), source.length, page);
  }, new AbortController().signal);
  assert.deepEqual(calls, [0, 1]);
  assert.deepEqual(result, source);
  assert.deepEqual(buildJournalExportData(result).at(-1)?.cells.slice(5), [50120.04, 50100, 20.04]);
});

test("empty exports retain a zero grand total", async () => {
  const groups = await loadJournalExportGroups(async () => payload([]), new AbortController().signal);
  assert.deepEqual(buildJournalExportData(groups).at(-1)?.cells.slice(5), [0, 0, 0]);
});

test("server exports preserve the browser calendar day regardless of server time zone", () => {
  const item = { ...group(), transactionDate: "2026-10-19T16:00:00Z" };
  assert.equal(buildJournalExportData([item], "Asia/Manila")[0].cells[0], "2026-10-20");
  assert.equal(buildJournalExportData([item], "UTC")[0].cells[0], "2026-10-19");
});

test("malformed, short, duplicate and changing results reject partial downloads", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(loadJournalExportGroups(async () => ({}), signal), /incomplete/);
  await assert.rejects(loadJournalExportGroups(async () => payload([group()], 2), signal), /all matching/);
  await assert.rejects(loadJournalExportGroups(async () => payload([group(), group()]), signal), /changed/);
  await assert.rejects(loadJournalExportGroups(async () => payload([{ ...group(), entries: [{ debit: NaN, credit: 0 }] }]), signal), /invalid/);
  await assert.rejects(loadJournalExportGroups(async page => page === 0
    ? payload(Array.from({ length: 500 }, (_, i) => group(i)), 501)
    : payload([group(500)], 502, 1), signal), /changed/);
  await assert.rejects(loadJournalExportGroups(async () => { throw new Error("upstream failed"); }, signal), /upstream failed/);
});

test("cancellation stops before requesting a page and after a pending response", async () => {
  const controller = new AbortController();
  controller.abort();
  let requested = false;
  await assert.rejects(loadJournalExportGroups(async () => { requested = true; return payload([]); }, controller.signal));
  assert.equal(requested, false);
  const pending = new AbortController();
  await assert.rejects(loadJournalExportGroups(async () => { pending.abort(); return payload([]); }, pending.signal));
});

test("server file generators preserve CP references, line descriptions, totals and cell types", () => {
  const item = group();
  item.entries[0].accountTitle = '=HYPERLINK("https://example.com")';
  const bytes = generateJournalExcel([item], "Oct 1, 2026 to Oct 31, 2026", ["Status: Posted"]);
  const workbook = XLSX.read(bytes, { type: "array", cellStyles: true });
  const sheet = workbook.Sheets["General Journal"];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });
  const index = rows.findIndex(row => row[2] === "CR-1\nCP#: CP-1");
  assert.ok(index >= 0);
  const account = sheet[XLSX.utils.encode_cell({ r: index, c: 3 })];
  assert.equal(account.t, "s");
  assert.equal(account.f, undefined);
  const debit = sheet[XLSX.utils.encode_cell({ r: index, c: 5 })];
  assert.equal(debit.t, "n");
  assert.equal(debit.v, 100.04);
  assert.ok(debit.z.includes("#,##0.00"));
  assert.ok(sheet["!rows"]?.[index]?.hpt === 30);
  assert.ok(rows.some(row => row[4] === "Shortage offset"));
  assert.deepEqual(rows.at(-1)?.slice(5), [100.04, 100, 0.04]);
  const pdf = generateJournalPdf([item], "Oct 1, 2026 to Oct 31, 2026", ["Status: Posted"]);
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), "%PDF-");
});
