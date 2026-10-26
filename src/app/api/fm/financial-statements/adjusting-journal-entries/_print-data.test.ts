import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdjustingEntry, AjePrintReport } from "@/modules/financial-management/financial-statements/adjusting-journal-entries/types";
import { ajeEntryPrintUrl, ajeReportUrl } from "@/modules/financial-management/financial-statements/adjusting-journal-entries/services/adjusting-journal-entries.api";
import { AJE_RESOURCE, AjePrintError, loadEntryPrint, loadSummaryPrint, printMoney, reportPrintParams, type SpringReader } from "./_print-data";

const actor = { userId: 24, userName: "Print Tester" };
const entry = { id: 900021, jeNo: "AJE-900021", transactionDate: "2026-10-20", status: "Posted",
  totalDebit: 123.45, totalCredit: 123.45, variance: 0, details: [] } as unknown as AdjustingEntry;
const report = (): AjePrintReport => ({ entries: [entry], totalRecords: 1, totalDebit: "123.45", totalCredit: "123.45",
  generatedBy: actor, generatedAt: "2026-10-20T07:00:00Z" });
const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...extra } });
const mockReport = (value: unknown): SpringReader => async () => json(value);

test("report query keeps effective filters including imbalance and workflow queue while removing pagination", () => {
  const params = reportPrintParams(new URLSearchParams("workspace=creation&format=pdf&page=3&pageSize=10&size=10&queue=awaiting-my-review&search=test&status=Needs+action&startDate=2026-10-01&endDate=2026-10-20&divisionId=2&departmentId=3&accountTypeId=4&sourceJeNo=JE-1&sort=jeNo,asc&unbalancedOnly=true"));
  assert.deepEqual(Object.fromEntries(params), { format: "json", search: "test", status: "Needs action", queue: "awaiting-my-review", workspace: "creation",
    startDate: "2026-10-01", endDate: "2026-10-20", divisionId: "2", departmentId: "3",
    accountTypeId: "4", sourceJeNo: "JE-1", sort: "jeNo,asc", unbalancedOnly: "true" });
  assert.equal(reportPrintParams(new URLSearchParams("status=All")).get("sort"), "lastActivity,desc");
});
test("new PDF URLs preserve legacy printing and omit list pagination", () => {
  assert.equal(ajeEntryPrintUrl(900021), "/api/fm/financial-statements/adjusting-journal-entries/900021/print");
  assert.equal(ajeEntryPrintUrl(900021, "pdf"), "/api/fm/financial-statements/adjusting-journal-entries/900021/print?format=pdf");
  const url = new URL(ajeReportUrl({ page: 4, pageSize: 10, status: "Needs action", sort: "lastActivity,desc" }, "pdf"), "http://localhost");
  assert.equal(url.searchParams.get("status"), "Needs action");
  assert.equal(url.searchParams.get("format"), "pdf");
  assert.equal(url.searchParams.has("page"), false);
  assert.equal(url.searchParams.has("pageSize"), false);
});
test("individual printing uses refreshed access for its metadata request and keeps response cookies", async () => {
  const calls: Array<[string, string | undefined]> = [];
  const spring: SpringReader = async (path, _init, token) => {
    calls.push([path, token]);
    return calls.length === 1
      ? json(entry, 200, { "Set-Cookie": "vos_access_token=refreshed-test-token; Path=/; HttpOnly" })
      : json(actor, 200, { "Set-Cookie": "refreshToken=refreshed-session; Path=/api/auth" });
  };
  const data = await loadEntryPrint("900021", spring);
  assert.deepEqual(calls, [[AJE_RESOURCE + "/900021", undefined], [AJE_RESOURCE + "/access", "refreshed-test-token"]]);
  assert.equal(data.cookies.length, 2);
  assert.equal(data.actor.userName, actor.userName);
});
for (const status of [401, 403, 404]) test("printing propagates upstream HTTP " + status + " without requesting more data", async () => {
  let calls = 0;
  const spring: SpringReader = async () => { calls++; return json({ message: "Access unavailable" }, status); };
  await assert.rejects(loadEntryPrint("900021", spring), error => error instanceof AjePrintError && error.status === status);
  assert.equal(calls, 1);
});
test("invalid entry identifiers never reach Spring", async () => {
  await assert.rejects(loadEntryPrint("../report", async () => { throw new Error("Must not call"); }), error => error instanceof AjePrintError && error.status === 400);
});
test("individual printing rejects incomplete details and invalid actors", async () => {
  await assert.rejects(loadEntryPrint("900021", async () => json({ ...entry, details: null })), /invalid adjustment details/);
  await assert.rejects(loadEntryPrint("900021", async path => json(path.endsWith("/access") ? {} : entry)), /verify the user/);
});
test("summary printing makes one report request and uses authoritative decimal totals", async () => {
  const expected = report();
  expected.entries = Array.from({ length: 105 }, (_, id) => ({ ...entry, id: id + 1 }));
  expected.totalRecords = 105;
  expected.totalDebit = "9007199254740993.21";
  let calls = 0;
  const result = await loadSummaryPrint(new URLSearchParams("page=9&status=Posted"), async path => {
    calls++; assert.ok(path.includes("/report?")); assert.ok(path.includes("format=json"));
    assert.ok(!path.includes("page=")); return json(expected);
  });
  assert.equal(calls, 1);
  assert.equal(result.report.entries.length, 105);
  assert.equal(result.report.totalDebit, expected.totalDebit);
});
test("empty summaries remain printable", async () => {
  const result = await loadSummaryPrint(new URLSearchParams(), mockReport({ ...report(), entries: [], totalRecords: 0, totalDebit: "0", totalCredit: "0" }));
  assert.equal(result.report.totalRecords, 0);
});
for (const value of [
  { ...report(), totalRecords: 2 },
  { ...report(), entries: [entry, entry], totalRecords: 2 },
  { ...report(), totalDebit: "not-money" },
  { ...report(), generatedBy: null },
]) test("summary printing rejects incomplete or inconsistent report data", async () => {
  await assert.rejects(loadSummaryPrint(new URLSearchParams(), mockReport(value)), /incomplete or invalid summary/);
});
test("an older ERP instance returns a clear compatibility error instead of a broken PDF", async () => {
  await assert.rejects(loadSummaryPrint(new URLSearchParams(), async () => new Response("Journal,Reference", {
    headers: { "Content-Type": "text/csv" },
  })), error => error instanceof AjePrintError && error.status === 503 && error.message.includes("Update ERP_SERVER"));
});
test("truncated JSON never becomes a partial report", async () => {
  await assert.rejects(loadSummaryPrint(new URLSearchParams(), async () => new Response('{"entries":[', {
    headers: { "Content-Type": "application/json", "Set-Cookie": "vos_access_token=new; Path=/" },
  })), error => error instanceof AjePrintError && error.cookies.length === 1 && error.message.includes("incomplete response"));
});
test("peso formatting preserves large decimal totals and signs without floating point summation", () => {
  assert.equal(printMoney("9007199254740993.21"), "₱9,007,199,254,740,993.21");
  assert.equal(printMoney("0"), "₱0.00");
  assert.equal(printMoney("-1234.50"), "-₱1,234.50");
  assert.equal(printMoney("99.999"), "₱100.00");
  assert.equal(printMoney("-0.00"), "₱0.00");
});
