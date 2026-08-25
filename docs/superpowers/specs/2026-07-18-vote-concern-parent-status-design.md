# Vote Concern Parent Status Design

## Objective

Align the my-level VoteModal submission path with Final Top Sheet behavior for line-level concerns.

## State transitions

- A line marked `WITH_CONCERN` updates its linked `expense_draft` to `With Concern`, including feedback and `return_to`.
- The linked `expense_draft_header` continues to be recalculated by the existing header synchronization logic.
- A line-level concern must not patch `disbursement_draft.status` to `With Concern`; the draft remains in its current approval-tier status.
- Existing rejection handling and ordinary approval-tier progression remain unchanged.

## Implementation boundary

Change the shared approval processor's parent-draft terminal-status condition. Do not alter VoteModal payload construction or Final Top Sheet behavior.

## Verification

Add a regression test for the lifecycle decision that proves `WITH_CONCERN` does not trigger a parent-draft terminal patch, while `REJECTED` and an empty remaining payable set retain their existing terminal behavior.
