# Bulk Approval Evidence Viewer Design

## Goal

Make document verification consistent in `VoteModal` and `AuditeeDetailSplitModal` by presenting Weekly Expense Report (WER) summary attachments before the supporting attachment for each expense line.

## Document Sources

The viewer has two explicitly identified document categories:

1. **WER Summary Attachment**: records from `expense_attachments`, selected by the `header_id` values in the currently opened approval context.
2. **Expense Attachment**: the `attachment_url` stored on an individual `expense_draft` line.

Documents outside the current draft or final top-sheet header scope must not be shown. Duplicate URLs are removed while preserving category and display order.

## Viewing Modes

### Show Docs

The modal-level Show Docs action opens the existing split evidence pane. Its carousel contains:

1. All WER summary attachments for every relevant header.
2. All available per-expense attachments in the modal's current line-item order.

### Line-item attachment action

Clicking a document action on an expense row opens the existing split evidence pane rather than opening only that document in the full-screen preview. Its carousel contains:

1. All WER summary attachments for every relevant header.
2. Only the clicked expense line's attachment, when present.

The expense table remains visible beside the evidence pane so the reviewer can compare the selected line with its WER summaries. The carousel starts at its first WER summary. If there are no WER summaries, it starts at the selected expense attachment.

The full-screen preview remains available from the evidence pane for the currently selected carousel document.

## Scope by Modal

### VoteModal

WER summaries include all `expense_attachments` records for the header IDs linked to the opened disbursement draft. The Show Docs mode adds every expense attachment in that draft. The line-item mode adds only the clicked row's expense attachment.

### AuditeeDetailSplitModal

WER summaries include all `expense_attachments` records for every header represented by the opened final top-sheet, including headers belonging to other auditees in that top-sheet. The Show Docs mode adds the per-expense attachments currently represented by the modal. The line-item mode adds only the clicked row's expense attachment.

## UI Identification

Every carousel slide displays a prominent category tag:

- `WER Summary Attachment`
- `Expense Attachment`

The existing file name or line description remains visible as the document label. The document count reflects the active viewing mode rather than the total number of documents available in other modes.

## Data Flow

The existing bulk-approval detail endpoints remain responsible for querying `expense_attachments`. Their responses must retain enough header metadata to scope WER summaries correctly.

Each modal converts its API response and expense lines into a common ordered viewer-item shape containing at least:

- URL
- display label
- category
- optional expense ID
- optional header ID

The active carousel list is derived from the selected viewing mode:

- `all`: WER summaries plus all expense attachments
- `line`: WER summaries plus the selected expense attachment

Changing modes resets the carousel index and image transformations so stale zoom, rotation, or slide position does not carry into the next review.

## Empty and Failure States

- If no WER summary exists, available expense attachments still appear.
- If a row has no expense attachment, its line-item document action remains hidden; WER summaries remain available through Show Docs.
- If neither category has a document, Show Docs is hidden and no empty split pane is opened.
- A failure to fetch `expense_attachments` must not prevent the approval detail itself from loading; expense attachments remain usable when available.

## Testing

Focused tests will verify:

1. WER summaries always precede expense attachments.
2. Show Docs includes all in-scope WER and expense documents.
3. A row action includes all in-scope WER summaries and only the clicked row attachment.
4. WER scope is all relevant headers for the current draft or final top-sheet.
5. Duplicate URLs are removed without changing WER-first order.
6. Category tags and document counts match the active list.
7. Missing WER summaries, missing line attachments, and both-missing states behave as specified.
8. Switching viewing modes resets the carousel and image transformations.

## Out of Scope

- Changes to how salesmen upload WER summaries.
- Database schema changes.
- Approval decision rules or permissions.
- A new nested document modal; both flows reuse their existing split evidence panes.
