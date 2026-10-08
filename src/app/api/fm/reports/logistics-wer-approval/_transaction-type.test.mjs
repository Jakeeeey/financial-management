import assert from "node:assert/strict";
import test from "node:test";
import { documentPrefixForTransactionType } from "../../../../../modules/financial-management/treasury/disbursement/document-number.ts";
import {
  isValidLogisticsWerDisbursementHeader,
  LOGISTICS_WER_TRANSACTION_TYPE,
} from "./_transaction-type.ts";

test("Logistics WER uses the Non-Trade transaction type and document prefix", () => {
  assert.equal(LOGISTICS_WER_TRANSACTION_TYPE, 2);
  assert.equal(documentPrefixForTransactionType(LOGISTICS_WER_TRANSACTION_TYPE), "NT");
});

test("accepts a persisted Non-Trade WER disbursement header", () => {
  assert.equal(isValidLogisticsWerDisbursementHeader({ transaction_type: 2, doc_no: "NT-1787233119333" }), true);
  assert.equal(isValidLogisticsWerDisbursementHeader({ transaction_type: { id: "2" }, doc_no: " nt-1787233119333 " }), true);
});

test("rejects headers with a Trade type or a non-NT document number", () => {
  assert.equal(isValidLogisticsWerDisbursementHeader({ transaction_type: 1, doc_no: "TR-1787233119333" }), false);
  assert.equal(isValidLogisticsWerDisbursementHeader({ transaction_type: 2, doc_no: "TR-1787233119333" }), false);
  assert.equal(isValidLogisticsWerDisbursementHeader({ transaction_type: 1, doc_no: "NT-1787233119333" }), false);
  assert.equal(isValidLogisticsWerDisbursementHeader({ transaction_type: 2, doc_no: "NT-invalid" }), false);
});
