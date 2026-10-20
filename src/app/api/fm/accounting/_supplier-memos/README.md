# Supplier memo edit, cancellation and printing

Both accounting modules use the existing Directus suppliers_memo collection.
Available is the existing unapplied state; no Draft/release workflow is added.
Every route verifies the Spring session and the corresponding module assignment
(administrators retain access). Credit routes require type 1; debit routes require
type 2.

## Changes and history

- Only Available memos without active disbursement links can be edited/cancelled.
  Posted, reserved and zero-value active links block changes. Missing transaction
  information and ambiguous supplier/reference matches fail closed.
- Number, type, encoder and creation time are immutable. Edits accept only supplier,
  GL account, memo date, original amount and memo reason. Cancellation writes
  CANCELLED; it never deletes the memo or restores a cancelled balance.
- Each action requires a separate reason, expected revision and request UUID.
  A pre-change intent is written to the existing audit_trail_table before PATCH.
  Completion/failure records preserve the application actor and before/after values.
  Rows use table_name=suppliers_memo and field_name=supplier_memo_v1.
- Native Directus revisions remain enabled. PATCH uses
  User-Agent: VOS-FM-SupplierMemo/<request UUID> to reconcile a lost response or
  failed completion log. Historical revisions without an application actor are
  labelled accordingly.
- The UI does not silently retry unconfirmed writes. An unresolved intent blocks
  further changes until its outcome is reconciled. Review the request ID, memo,
  native revision/activity and audit events; do not delete audit history to unlock
  a record.

## Scope and guarantees

The existing process-local disbursement lock serializes memo-bearing BFF changes
within one Node process. The expected revision also detects completed intervening
changes. Directus audit and memo writes are separate HTTP requests: this is **not**
a database transaction or a cross-process lock. Simultaneous writes from another
BFF instance, Spring, Directus or SQL can race. Database-level atomic guarantees
require a separately scoped backend/database change.

No collection, column, permission or ERP migration is included. The configured
service token must retain existing read/write access to suppliers_memo, create/
read access to audit_trail_table, read access to native revisions/activity, and
the supplier/account/user/module/disbursement lookups. Missing access fails closed.
Unknown historical Applied/Used balances are labelled Needs review.

## Print and verification

Each module exposes [id]/print (A5 portrait slip) and report (A4 landscape
summary). The summary applies the same search, supplier, account, status and date
filters as the table, across all pages. Cancelled amounts are shown separately.
Noto Sans is bundled under its OFL license so peso glyphs render in server PDFs.
Validate final scaling and alignment on the intended physical printer.

Run:

    npx.cmd --yes tsx --test src/app/api/fm/accounting/_supplier-memos/service.test.ts
    npm.cmd run typecheck
    npm.cmd run lint
    git diff --check
