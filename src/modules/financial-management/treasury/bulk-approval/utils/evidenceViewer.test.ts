import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import type {
  DraftDetail,
  FinalTopSheetResponse,
} from "../type";
import type {
  DraftDetail as ServiceDraftDetail,
  FinalTopSheetResponse as ServiceFinalTopSheetResponse,
} from "../services/bulkApproval.types";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Expect<Value extends true> = Value;

type DraftAttachmentsQueryOkContract = Expect<Equal<DraftDetail["attachments_query_ok"], boolean>>;
type DraftAttachmentHeaderContract = Expect<Equal<NonNullable<DraftDetail["attachments"]>[number]["header_id"], number>>;
type DraftPayableHeaderContract = Expect<Equal<DraftDetail["payables"][number]["header_id"], number>>;
type FinalAttachmentsQueryOkContract = Expect<Equal<FinalTopSheetResponse["attachments_query_ok"], boolean>>;
type ServiceDraftAttachmentsQueryOkContract = Expect<Equal<ServiceDraftDetail["attachments_query_ok"], boolean>>;
type ServiceDraftAttachmentHeaderContract = Expect<Equal<NonNullable<ServiceDraftDetail["attachments"]>[number]["header_id"], number>>;
type ServiceDraftPayableHeaderContract = Expect<Equal<ServiceDraftDetail["payables"][number]["header_id"], number>>;
type ServiceFinalAttachmentsQueryOkContract = Expect<Equal<ServiceFinalTopSheetResponse["attachments_query_ok"], boolean>>;

void ({} as DraftAttachmentsQueryOkContract);
void ({} as DraftAttachmentHeaderContract);
void ({} as DraftPayableHeaderContract);
void ({} as FinalAttachmentsQueryOkContract);
void ({} as ServiceDraftAttachmentsQueryOkContract);
void ({} as ServiceDraftAttachmentHeaderContract);
void ({} as ServiceDraftPayableHeaderContract);
void ({} as ServiceFinalAttachmentsQueryOkContract);

const require = createRequire(import.meta.url);
const { buildEvidenceViewerState } = require("./evidenceViewer.ts") as typeof import("./evidenceViewer");

test("orders WER evidence before expense evidence and identifies missing headers", () => {
  const state = buildEvidenceViewerState({
    headers: [
      { headerId: 10, label: "Alice" },
      { headerId: 20, label: "Bob" },
    ],
    werAttachments: [{ headerId: 10, url: "wer-a", label: "Alice WER" }],
    expenseAttachments: [
      { expenseId: 101, headerId: 10, url: "line-a", label: "Meal" },
      { expenseId: 202, headerId: 20, url: "line-b", label: "Fuel" },
    ],
  });

  assert.deepEqual(state.allItems.map(({ url }) => url), ["wer-a", "line-a", "line-b"]);
  assert.deepEqual(state.lineItemsByExpenseId.get(202)?.map(({ url }) => url), [
    "wer-a",
    "line-b",
  ]);
  assert.deepEqual(state.missingHeaders, [{ headerId: 20, label: "Bob" }]);
});

test("deduplicates non-empty URLs with WER evidence taking priority", () => {
  const state = buildEvidenceViewerState({
    headers: [{ headerId: 10, label: "Alice" }],
    werAttachments: [
      { headerId: 10, url: "shared", label: "First WER" },
      { headerId: 10, url: "shared", label: "Duplicate WER" },
      { headerId: 10, url: "", label: "Empty WER URL" },
    ],
    expenseAttachments: [
      { expenseId: 101, headerId: 10, url: "shared", label: "Duplicate expense" },
      { expenseId: 101, headerId: 10, url: "line-a", label: "Meal" },
      { expenseId: 101, headerId: 10, url: "line-a", label: "Duplicate meal" },
      { expenseId: 202, headerId: 10, url: "", label: "Empty expense URL" },
    ],
  });

  assert.deepEqual(state.allItems, [
    { category: "wer-summary", headerId: 10, url: "shared", label: "First WER" },
    { category: "expense", expenseId: 101, headerId: 10, url: "line-a", label: "Meal" },
  ]);
  assert.deepEqual(state.lineItemsByExpenseId.get(101)?.map(({ url }) => url), [
    "shared",
    "line-a",
  ]);
  assert.equal(state.lineItemsByExpenseId.has(202), false);
});

test("reports no missing headers when every header has surviving WER evidence", () => {
  const state = buildEvidenceViewerState({
    headers: [
      { headerId: 10, label: "Alice" },
      { headerId: 20, label: "Bob" },
    ],
    werAttachments: [
      { headerId: 10, url: "wer-a", label: "Alice WER" },
      { headerId: 20, url: "wer-b", label: "Bob WER" },
    ],
    expenseAttachments: [],
  });

  assert.deepEqual(state.missingHeaders, []);
});

test("returns empty collections for empty inputs", () => {
  const state = buildEvidenceViewerState({
    headers: [],
    werAttachments: [],
    expenseAttachments: [],
  });

  assert.deepEqual(state.allItems, []);
  assert.equal(state.lineItemsByExpenseId.size, 0);
  assert.deepEqual(state.missingHeaders, []);
});

test("keeps all top-sheet WER summaries when reviewing one expense line", () => {
  const state = buildEvidenceViewerState({
    headers: [
      { headerId: 10, label: "Alice — Header #10" },
      { headerId: 20, label: "Bob — Header #20" },
      { headerId: 30, label: "Alice — Header #30" },
    ],
    werAttachments: [
      { headerId: 10, url: "wer-10", label: "WER 10" },
      { headerId: 20, url: "wer-20", label: "WER 20" },
      { headerId: 30, url: "wer-30", label: "WER 30" },
    ],
    expenseAttachments: [
      { expenseId: 101, headerId: 10, url: "expense-101", label: "Meal" },
      { expenseId: 202, headerId: 20, url: "expense-202", label: "Fuel" },
    ],
  });

  assert.deepEqual(state.lineItemsByExpenseId.get(101)?.map(({ url }) => url), [
    "wer-10",
    "wer-20",
    "wer-30",
    "expense-101",
  ]);
});
