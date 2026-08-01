# Bulk Approval Evidence Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all in-scope WER summary documents before expense documents in both approval modals, support WER-plus-selected-line split review, and warn approvers about each header missing a WER summary.

**Architecture:** Preserve header identity and attachment-query status in both detail API responses. Centralize ordering, deduplication, line selection, and missing-header detection in a pure evidence-viewer helper used by both modals; the existing split panes render the helper's active list.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Directus REST, Node.js 24 built-in test runner, existing shadcn/Radix UI and Embla carousel.

## Global Constraints

- WER Summary attachments are records from `expense_attachments` linked to headers in the currently opened draft or final top-sheet.
- WER Summary attachments always precede expense-line attachments.
- Show Docs includes all in-scope WER summaries followed by all in-scope expense attachments.
- A line-item action includes all in-scope WER summaries followed by only the clicked line's attachment.
- Every slide is tagged `WER Summary Attachment` or `Expense Attachment`.
- Missing-WER warnings are informational and identify every uncovered in-scope header.
- A failed WER query must not be reported as a successful query with missing attachments.
- Do not add dependencies or change approval permissions and decision rules.

---

### Task 1: Shared evidence-viewer model and ordering rules

**Files:**
- Create: `src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.ts`
- Create: `src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.test.ts`

**Interfaces:**
- Produces: `EvidenceHeader`, `WerSummaryAttachment`, `ExpenseEvidenceAttachment`, `EvidenceViewerItem`, `buildEvidenceViewerState(input)`.
- `buildEvidenceViewerState` returns `{ allItems, lineItemsByExpenseId, missingHeaders }` with WER-first, URL-deduplicated lists.

- [ ] **Step 1: Write failing pure-logic tests**

Create table-driven `node:test` cases covering WER-first order, all-doc mode, selected-line mode, URL deduplication, partial header coverage, full coverage, and empty inputs. Use this core fixture:

```ts
const input = {
  headers: [
    { headerId: 10, label: "Alice", },
    { headerId: 20, label: "Bob", },
  ],
  werAttachments: [
    { headerId: 10, url: "wer-a", label: "Alice WER" },
  ],
  expenseAttachments: [
    { expenseId: 101, headerId: 10, url: "line-a", label: "Meal" },
    { expenseId: 202, headerId: 20, url: "line-b", label: "Fuel" },
  ],
};
```

Assert `allItems.map(i => i.url)` equals `['wer-a', 'line-a', 'line-b']`, `lineItemsByExpenseId.get(202)?.map(i => i.url)` equals `['wer-a', 'line-b']`, and `missingHeaders` equals `[{ headerId: 20, label: 'Bob' }]`.

- [ ] **Step 2: Run the test and verify the missing module failure**

Run:

```powershell
node --experimental-strip-types --test src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.test.ts
```

Expected: FAIL because `./evidenceViewer.ts` does not exist.

- [ ] **Step 3: Implement the pure helper**

Implement these exported types and function:

```ts
export type EvidenceCategory = "wer-summary" | "expense";
export type EvidenceHeader = { headerId: number; label: string };
export type WerSummaryAttachment = { headerId: number; url: string; label: string };
export type ExpenseEvidenceAttachment = {
  expenseId: number;
  headerId: number;
  url: string;
  label: string;
};
export type EvidenceViewerItem = {
  category: EvidenceCategory;
  headerId: number;
  expenseId?: number;
  url: string;
  label: string;
};

export function buildEvidenceViewerState(input: {
  headers: EvidenceHeader[];
  werAttachments: WerSummaryAttachment[];
  expenseAttachments: ExpenseEvidenceAttachment[];
}) {
  const dedupe = (items: EvidenceViewerItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => item.url && !seen.has(item.url) && Boolean(seen.add(item.url)));
  };
  const werItems = dedupe(input.werAttachments.map((item) => ({ ...item, category: "wer-summary" as const })));
  const expenseItems = dedupe(input.expenseAttachments.map((item) => ({ ...item, category: "expense" as const })));
  const covered = new Set(werItems.map((item) => item.headerId));
  return {
    allItems: dedupe([...werItems, ...expenseItems]),
    lineItemsByExpenseId: new Map(input.expenseAttachments.map((line) => [
      line.expenseId,
      dedupe([...werItems, { ...line, category: "expense" as const }]),
    ])),
    missingHeaders: input.headers.filter((header) => !covered.has(header.headerId)),
  };
}
```

If `Boolean(seen.add(...))` fails lint clarity rules, replace it with an explicit block that calls `seen.add(item.url)` and returns `true`.

- [ ] **Step 4: Run focused tests and typecheck**

Run the Node test command above, then:

```powershell
npx tsc --noEmit --pretty false
```

Expected: all evidence-viewer tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the shared model**

```powershell
git add src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.ts src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.test.ts
git commit -m "test: define bulk approval evidence ordering"
```

---

### Task 2: Preserve WER header scope and query status in API contracts

**Files:**
- Modify: `src/modules/financial-management/treasury/bulk-approval/type.ts`
- Modify: `src/modules/financial-management/treasury/bulk-approval/services/bulkApproval.types.ts`
- Modify: `src/modules/financial-management/treasury/bulk-approval/services/myLevelApproval.service.ts`
- Modify: `src/modules/financial-management/treasury/bulk-approval/services/finalTopSheets.service.ts`

**Interfaces:**
- Produces on both detail responses: `attachments_query_ok: boolean`.
- Produces per WER attachment: `{ header_id: number; file_url: string; file_name: string; encoder_id?: number }`.
- Produces enough header identity for the UI: Vote payables retain `header_id`; final top-sheet details and salesmen already retain it.

- [ ] **Step 1: Add compile-time response-contract assertions**

In `evidenceViewer.test.ts`, import `DraftDetail` and `FinalTopSheetResponse` as types and add assignments that require `attachments_query_ok`, attachment `header_id`, and payable `header_id`. Run `npx tsc --noEmit --pretty false` and expect FAIL on the missing fields.

- [ ] **Step 2: Extend public and service-local types**

Add `header_id: number` to returned draft payable items. Change `DraftDetail.attachments` and the equivalent service type to include `header_id`. Add `attachments_query_ok: boolean` to `DraftDetail` and `FinalTopSheetResponse` plus mirrored service types.

- [ ] **Step 3: Update My Level Approval response mapping**

Query `expense_attachments` with `fields=id,header_id,file_url,file_name`, map `header_id` into each response attachment, retain each payable's resolved expense header ID, and set:

```ts
attachments_query_ok: attachmentsRes.ok,
```

Do not throw when the query fails; return an empty attachment list with the status flag set to `false`.

- [ ] **Step 4: Update Final Top-Sheet response mapping**

Keep the existing header-aware query and mapping, and add `attachments_query_ok: attachmentsRes.ok` to both populated and empty response shapes. Ensure the empty shape uses `true` when there were no linked headers to query and no query failed.

- [ ] **Step 5: Run typecheck and lint for changed service files**

```powershell
npx tsc --noEmit --pretty false
npx eslint src/modules/financial-management/treasury/bulk-approval/type.ts src/modules/financial-management/treasury/bulk-approval/services/bulkApproval.types.ts src/modules/financial-management/treasury/bulk-approval/services/myLevelApproval.service.ts src/modules/financial-management/treasury/bulk-approval/services/finalTopSheets.service.ts
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the API contract**

```powershell
git add src/modules/financial-management/treasury/bulk-approval/type.ts src/modules/financial-management/treasury/bulk-approval/services/bulkApproval.types.ts src/modules/financial-management/treasury/bulk-approval/services/myLevelApproval.service.ts src/modules/financial-management/treasury/bulk-approval/services/finalTopSheets.service.ts src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.test.ts
git commit -m "feat: expose WER attachment coverage"
```

---

### Task 3: VoteModal split evidence modes and warning

**Files:**
- Modify: `src/modules/financial-management/treasury/bulk-approval/components/VoteModal.tsx`

**Interfaces:**
- Consumes: `buildEvidenceViewerState`, `DraftDetail.attachments_query_ok`, header-aware payables and WER attachments.
- Produces: modal-level all-doc mode and row-level WER-plus-selected-line mode.

- [ ] **Step 1: Add a VoteModal-shaped regression fixture**

Extend `evidenceViewer.test.ts` with the exact header, WER, and expense arrays that VoteModal will derive, including the explicit fallback label `Header #10`. Assert the resulting all-doc and selected-line URLs and missing-header labels, then run the focused Node test and expect PASS. This locks the pure contract before wiring React state without adding a component-test dependency.

- [ ] **Step 2: Replace raw `detail.attachments` rendering with active evidence state**

Add state:

```ts
const [evidenceMode, setEvidenceMode] = React.useState<{ kind: "all" } | { kind: "line"; expenseId: number }>({ kind: "all" });
```

Derive unique headers from payables, WER items from `detail.attachments`, expense items from combined expense rows, then call `buildEvidenceViewerState`. Select `allItems` for `all` mode or `lineItemsByExpenseId.get(expenseId) ?? []` for line mode.

- [ ] **Step 3: Make the header action open all-doc mode**

Before opening the split pane, set `{ kind: "all" }`, reset carousel slide, inline zoom, and rotation, and scroll the carousel to index 0 when its API is available.

- [ ] **Step 4: Make each row action open line mode**

Replace `setPreviewUrl(...)` with a handler that sets `{ kind: "line", expenseId }`, opens the split pane, and resets slide/zoom/rotation. Keep the full-screen action inside the split pane and point it at the active evidence item.

- [ ] **Step 5: Render category tags and missing-WER warning**

Render `WER Summary Attachment` for `wer-summary` and `Expense Attachment` for `expense`. Add an amber informational banner near the document controls when `attachments_query_ok` is true and `missingHeaders` is non-empty; list header labels/IDs. When the flag is false, show a distinct “WER summaries could not be loaded” warning.

- [ ] **Step 6: Verify VoteModal**

```powershell
node --experimental-strip-types --test src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.test.ts
npx eslint src/modules/financial-management/treasury/bulk-approval/components/VoteModal.tsx src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.ts
npx tsc --noEmit --pretty false
```

Expected: tests pass; lint and typecheck exit 0.

- [ ] **Step 7: Commit VoteModal**

```powershell
git add src/modules/financial-management/treasury/bulk-approval/components/VoteModal.tsx src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.test.ts
git commit -m "feat: compare WER summaries in level approval"
```

---

### Task 4: AuditeeDetailSplitModal split evidence modes and warning

**Files:**
- Modify: `src/modules/financial-management/treasury/bulk-approval/components/AuditeeDetailSplitModal.tsx`

**Interfaces:**
- Consumes: the same shared evidence helper and `FinalTopSheetResponse` attachment contract.
- Produces: all-top-sheet WER scope in both viewing modes, with only the clicked expense attachment in line mode.

- [ ] **Step 1: Add a final-top-sheet scope regression fixture**

Add a helper test with three headers across two auditees. Assert the WER list contains summaries from all three headers even when the selected line belongs to one auditee, while line mode contains only that line attachment after all WER items. Run the focused Node test and expect PASS before wiring the modal to this contract.

- [ ] **Step 2: Replace fallback attachment collection**

Remove the current “line attachments first, header attachments only if none exist” logic. Derive headers from every `data.details` record, use salesman names when their `header_id` matches, and build all WER and expense inputs separately before calling `buildEvidenceViewerState`.

- [ ] **Step 3: Add all-doc and line-item modes**

Add the same discriminated `evidenceMode` state as VoteModal. The header action selects `all`; the row attachment action selects `line` and opens the existing left split pane. Both handlers reset slide, zoom, and rotation.

- [ ] **Step 4: Render active items, tags, and warnings**

Change the carousel, full-screen action, count badge, and split-width condition to use active items. Add the category tag and the same missing/query-failed warning copy near the document controls. Ensure final-approver read-only state does not hide document access or warnings.

- [ ] **Step 5: Verify AuditeeDetailSplitModal**

```powershell
node --experimental-strip-types --test src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.test.ts
npx eslint src/modules/financial-management/treasury/bulk-approval/components/AuditeeDetailSplitModal.tsx src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.ts
npx tsc --noEmit --pretty false
```

Expected: tests pass; lint and typecheck exit 0.

- [ ] **Step 6: Commit final-approver evidence flow**

```powershell
git add src/modules/financial-management/treasury/bulk-approval/components/AuditeeDetailSplitModal.tsx src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.test.ts
git commit -m "feat: compare WER summaries in final approval"
```

---

### Task 5: End-to-end static verification and regression review

**Files:**
- Review: all files changed in Tasks 1-4

**Interfaces:**
- Consumes: completed API contract and both modal implementations.
- Produces: verified implementation with no unrelated staged files.

- [ ] **Step 1: Run the complete focused verification set**

```powershell
node --experimental-strip-types --test src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.test.ts
npx eslint src/modules/financial-management/treasury/bulk-approval/components/VoteModal.tsx src/modules/financial-management/treasury/bulk-approval/components/AuditeeDetailSplitModal.tsx src/modules/financial-management/treasury/bulk-approval/services/myLevelApproval.service.ts src/modules/financial-management/treasury/bulk-approval/services/finalTopSheets.service.ts src/modules/financial-management/treasury/bulk-approval/utils/evidenceViewer.ts
npx tsc --noEmit --pretty false
```

Expected: all tests PASS; ESLint and TypeScript exit 0.

- [ ] **Step 2: Review the diff against the spec**

Confirm WER-first ordering, both viewing modes, all-header final top-sheet scope, category tags, partial-coverage warnings, query-failure warnings, full-screen preview continuity, and unchanged approval permissions.

- [ ] **Step 3: Confirm unrelated work remains untouched**

Run `git status --short` and verify the pre-existing changes to `package-lock.json` and `src/components/ui/dialog.tsx` were not staged or modified by this implementation.

- [ ] **Step 4: Commit any verification-only corrections**

If the review required corrections, stage only the bulk-approval files and commit them as:

```powershell
git commit -m "fix: complete bulk approval evidence verification"
```

If no corrections were needed, do not create an empty commit.
