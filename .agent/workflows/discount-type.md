---
description: How to manage discount types and sequential bundles
---

# Discount Type Workflow

This workflow explains how to create and manage bundles of line discounts.

## 1. Viewing Discount Types
1. Navigate to the Discount Types page.
2. The table displays current discount types and their computed total percentage.
3. Clicking a row opens the `DiscountTypeDialog` in `view` mode.

## 2. Creating a Discount Type
1. Click "Add Discount Type".
2. Enter the name of the discount type.
3. Select and arrange line discounts to create a sequential bundle.
   - Note: The order of line discounts matters as they are applied sequentially.
4. The dialog calculates the total percent based on the selected lines.
5. Click "Save" to trigger `fp.createDiscountType`.

## 3. Editing and Deleting
1. While in "view" mode (after clicking a row), you can switch to `edit` mode to modify the bundle.
2. Changes are saved using `fp.updateDiscountType`.
3. To remove a discount type, use the "Delete" action in the dialog which triggers `fp.deleteDiscountType`.

## 4. Technical Details
- **Main Component**: `DiscountTypeModule.tsx`
- **Hook**: `useDiscountTypes.ts`
- **API Wrapper**: `providers/fetchProvider.ts`
- **Dialog**: `DiscountTypeDialog.tsx`
