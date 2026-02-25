---
description: How to manage single line discounts
---

# Line Discount Workflow

This workflow describes how to manage individual line discounts which can be used to build sequential discount bundles.

## 1. Viewing Line Discounts
1. Navigate to the Line Discounts page.
2. The page uses the `useLineDiscounts` hook to fetch data from the server.
3. You can use search and filters provided in the data table to find specific discounts.

## 2. Creating a Line Discount
1. Click the "Add Line Discount" (or similar trigger) in the table actions.
2. This opens the `LineDiscountDialog` in `create` mode.
3. Enter the line discount details (e.g., name/label and percentage).
4. Save the form. The `create` function will call `api.createLineDiscount` and update the local state.

## 3. Editing a Line Discount
1. Find the discount you wish to change in the table.
2. Use the "Edit" action from the table meta/actions.
3. This opens the `LineDiscountDialog` in `edit` mode with the existing data.
4. Modify the values and save. The `update` function will call `api.updateLineDiscount`.

## 4. Deletions
1. Select the "Delete" action for a specific line discount.
2. Confirm the action in the `DeleteConfirmDialog`.
3. The `remove` function will call `api.deleteLineDiscount` and remove the item from the list.

## 5. Technical Details
- **Main Component**: `LineDiscountModule.tsx`
- **Hook**: `useLineDiscounts.ts`
- **API Wrapper**: `providers/fetchProvider.ts`
- **Dialogs**: `LineDiscountDialog.tsx`, `DeleteConfirmDialog.tsx`
