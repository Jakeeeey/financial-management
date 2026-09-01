# Bulk Approval — Final Approver Top Sheet Loader Fix

Updated files:

- `BulkApprovalModule.tsx`
- `components/DraftListTable.tsx`
- `hooks/useBulkApproval.ts`
- `type.ts`
- `services/bulkApproval.types.ts`
- `services/myLevelApproval.service.ts`

Latest addition:

- Added a shadcn/Gemini-style redirecting overlay when a My Level row needs to open the Final Top Sheet matrix.
- The clicked `Open Top Sheet` row button now shows `Opening...` with a spinner while resolving/loading the matching top-sheet group.
- The redirect loader shows the draft doc no, division, and encoder/salesman while switching to the Final Top Sheets tab and opening the matrix modal.

Replace the matching files in your module using the same paths.
