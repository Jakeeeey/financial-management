---
description: How to manage the Chart of Accounts
---

# Chart of Accounts Workflow

This workflow describes how to manage account titles and General Ledger (GL) codes.

## 1. Browsing Accounts
1. Open the Chart of Accounts module.
2. Use the search input to filter accounts by "Account Title" or "GL Code".
3. Navigate through pages using "Previous" and "Next" buttons. Pagination is handled by the `useChartOfAccounts` hook.

## 2. Adding a New Account
1. Click the "Add Account" button.
2. Fill in the form in the `COAFormDialog`:
   - Account Title
   - GL Code
   - Account Type (Asset, Liability, Equity, Income, Expense)
   - Balance Type (Debit, Credit)
   - BSIS Type
3. Click "Save" to trigger the `create` function which calls `api.createCOA`.

## 3. Editing an Account
1. Find the account in the table.
2. Click the "Edit" action (handled by `onEdit`).
3. Modify the desired fields in the dialog.
4. Click "Save" to trigger the `update` function which calls `api.updateCOA`.

## 4. Deleting an Account
1. Click the "Delete" action for a specific account.
2. Confirm the deletion in the `DeleteConfirmDialog`.
3. The `remove` function will call `api.deleteCOA` and refresh the list.

## 5. Technical Details
- **Main Component**: `ChartOfAccountsModule.tsx`
- **Hook**: `useChartOfAccounts.ts`
- **API Wrapper**: `providers/fetchProvider.ts`
- **Types**: `types.ts`
