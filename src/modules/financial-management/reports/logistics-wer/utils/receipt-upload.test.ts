import assert from "node:assert/strict";
import test from "node:test";
import { MAX_RECEIPT_BYTES, validateReceiptFile } from "./receipt-upload";

test("accepts supported formats and the exact size boundary", () => {
  for (const [name, type] of [["scan.JPG", "image/jpeg"], ["scan.jpeg", "image/jpeg"], ["scan.png", "image/png"], ["scan.pdf", "application/pdf"], ["scan.pdf", ""]]) {
    assert.equal(validateReceiptFile({ name, type, size: MAX_RECEIPT_BYTES }), null);
  }
});
test("rejects oversized, empty and unsupported receipts", () => {
  assert.equal(validateReceiptFile({ name: "scan.pdf", type: "application/pdf", size: MAX_RECEIPT_BYTES + 1 })?.status, 413);
  assert.equal(validateReceiptFile({ name: "scan.pdf", type: "application/pdf", size: 0 })?.status, 400);
  for (const [name, type] of [["scan.exe", ""], ["scan.jpg", "application/pdf"], ["scan", "image/png"]]) {
    assert.equal(validateReceiptFile({ name, type, size: 10 })?.status, 415);
  }
});
