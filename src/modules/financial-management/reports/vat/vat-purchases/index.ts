// index.ts
// Barrel export — import from one place:
//   import VatPurchasesModule from '@/modules/financial-management/reports/vat/vat-purchases'

// Main module
export { default } from './VatPurchasesModule';
export * from './types';
export * from './utils';
export * from './hooks/useVATPurchases';
export * from './components/VATLineChart';
export * from './components/VATSupplierPieChart';
export * from './components/VATSupplierComparison';
export * from './components/VATTransactionsTable';