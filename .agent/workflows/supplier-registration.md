---
description: How to manage supplier registrations and details
---

# Supplier Registration Workflow

This workflow covers the registration and management of supplier information.

## 1. Searching for Suppliers
1. Navigate to the Supplier Registration page.
2. The page loads suppliers using the `useSuppliers` hook.
3. Use the search bar to filter by name, TIN, contact person, or supplier type. The search performs both API-side and client-side filtering for responsiveness.

## 2. Registering a New Supplier
1. Click the "Add New Supplier" button.
2. Complete the form in the `AddSupplierModal`.
3. Essential fields include:
   - Supplier Name
   - TIN Number
   - Contact Person
   - Address and Contact Details
4. On success, the supplier list is refreshed and a success toast is shown.

## 3. Viewing and Editing Supplier Details
1. **View**: Click the "View" action on a supplier row to open `SupplierDetailsModal`.
2. **Edit**: Click the "Edit" action to open `EditSupplierModal`.
3. Updating details will trigger a refresh of the table data.

## 4. Technical Details
- **Main Component**: `SupplierRepresentativeModulePage.tsx`
- **Hook**: `useSuppliers.ts`
- **API Endpoint**: `/api/supplier-registration/suppliers`
- **Modals**: `AddSupplierModal.tsx`, `EditSupplierModal.tsx`, `SupplierDetailsModal.tsx`
