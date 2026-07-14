# Patch Note: Fix Price Change Manifest Visibility

## Issue Description
Approved price change requests and direct pricing upserts were not reflecting in the masterlist (product catalog/pricing grid).

### Root Cause
- The database (`product_per_price_type` table) requires active/valid price records to have a `status` value of `"approved"` to be visible under standard role permissions.
- When a price change request was approved/applied (in `_actions.ts`) or direct prices were bulk-upserted (in `prices-upsert/route.ts`), the backend code was hardcoded to write a status of `"draft"`.
- This mismatch caused all recently approved/updated prices to remain hidden as drafts in the master list.

## Fix Implemented
1. **API Corrections:**
   - Modified the `applyProposedPrice` payload in `src/app/api/fm/product-pricing/price-change-requests/_actions.ts` to set `status: "approved"` upon request approval.
   - Modified the upsert payload in `src/app/api/fm/product-pricing/prices-upsert/route.ts` to default to `status: "approved"` instead of `"draft"`.
2. **Database Reconciliation:**
   - Identified and updated existing price records that were stuck in `"draft"` status to `"approved"`, immediately restoring visibility for recently approved changes.
