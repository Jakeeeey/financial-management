import assert from "node:assert/strict";
import { test } from "node:test";
import type { CashFlowEntry } from "../types/cash-flow.schema";
import {
  buildCashFlowExcelWorksheet,
  prepareCashFlowExport,
  type CashFlowExportContext,
} from "./cash-flow-export.service";

const entries: CashFlowEntry[] = [
  { transactionRef: "OP-002", transactionDate: "2026-10-02", cashFlowActivity: "Operating", netCashFlow: 2500.5 },
  { transactionRef: "INV-001", transactionDate: "2026-10-01", cashFlowActivity: "Investing", netCashFlow: -700 },
  { transactionRef: "OP-001", transactionDate: "2026-10-03", cashFlowActivity: "Operating", netCashFlow: 100 },
  { transactionRef: "UNK-001", transactionDate: "2026-10-04", cashFlowActivity: null, netCashFlow: 25 },
];

const context: CashFlowExportContext = {
  entries,
  startDate: "2026-10-01",
  endDate: "2026-10-23",
  search: "OP-",
  activity: "operating",
  sortField: "transactionDate",
  sortOrder: "desc",
  generatedAt: new Date("2026-10-23T04:00:00.000Z"),
};

test("statement export retains the full applied-period report and discloses transaction filters as context", () => {
  const prepared = prepareCashFlowExport("statement", context);

  assert.equal(prepared.entries.length, entries.length);
  assert.equal(prepared.summaryRows[3].value, 1900.5);
  assert.equal(prepared.metadataRows.find(([label]) => label === "Transaction search")?.[1], "OP-");
  assert.match(String(prepared.metadataRows.find(([label]) => label === "Filter scope note")?.[1]), /context only/);
});

test("transaction export applies search and activity filters and returns all matches in sort order", () => {
  const prepared = prepareCashFlowExport("transactions", context);

  assert.deepEqual(prepared.entries.map(entry => entry.transactionRef), ["OP-001", "OP-002"]);
  assert.equal(prepared.summaryRows[0].value, 2);
  assert.equal(prepared.summaryRows[1].value, 2600.5);
  assert.match(String(prepared.metadataRows.find(([label]) => label === "Export scope")?.[1]), /across pages/);
});

test("Excel exports retain numeric amount cells with peso currency formatting", () => {
  const worksheet = buildCashFlowExcelWorksheet("statement", { ...context, search: "", activity: "all" });
  const operatingTotal = worksheet.B19;
  const referenceAddress = Object.entries(worksheet).find(([address, cell]) =>
    /^A\d+$/.test(address) && cell?.v === "OP-002",
  )?.[0];
  const detailAmount = referenceAddress
    ? worksheet[`D${referenceAddress.slice(1)}`]
    : undefined;

  assert.equal(operatingTotal?.t, "n");
  assert.equal(operatingTotal?.v, 2600.5);
  assert.match(String(operatingTotal?.z), /\u20B1/);
  assert.equal(detailAmount?.t, "n");
  assert.equal(detailAmount?.v, 2500.5);
  assert.match(String(detailAmount?.z), /\u20B1/);
});
