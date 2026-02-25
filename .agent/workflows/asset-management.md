---
description: How to manage assets in the Asset Management module
---

# Asset Management Workflow

This workflow describes how to perform common tasks in the Asset Management module.

## 1. Viewing Assets
1. Navigate to the Asset Management page (`/fm/asset-management`).
2. The page automatically fetches assets on load using the `fetchAssets` function.
3. You can use the search bar to filter assets by various columns.
4. Click the "Refresh" button to manually trigger a data fetch from `/api/fm/asset-management`.

## 2. Adding a New Asset
1. Click the "Add Asset" button (which triggers the `AddAssetModal`).
2. Fill in the asset details:
   - Asset Name
   - Category
   - Cost per Item
   - Quantity
   - Life Span (years)
   - Date Acquired
   - Department (fetched from `/api/fm/asset-management?type=departments`)
   - Encoder (fetched from `/api/fm/asset-management?type=users`)
3. Submit the form. The `createAsset` service in `assetService.ts` will send a POST request to `/api/fm/asset-management`.
4. Upon success, the asset list will automatically refresh.

## 3. Calculating Depreciation
- The module uses the `getDepreciatedValue` utility from `utils/lib.ts` to calculate the current value of assets based on their cost, quantity, life span, and date acquired.
- You can change the "Projection Date" in the table header to see the projected depreciated value.

## 4. Technical Details
- **Main Component**: `AssetManagementModulePage.tsx`
- **Service**: `assetService.ts`
- **API Endpoint**: `/api/fm/asset-management`
- **Hooks**: `useCreateAsset.tsx` (if used in components)
- **Providers**: `assetProvider.tsx`
