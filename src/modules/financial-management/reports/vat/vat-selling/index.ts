// index.ts
// Barrel export — import from one place:
//   import VatSellingModule from '@/modules/financial-management/reports/vat/vat-selling'

// Main module
export { default } from './VatSellingModule';
export * from './types';
export * from './utils';
export * from './hooks/useVATSelling';
export * from './components/VATSaleLineChart';
export * from './components/VATSupplierPieChart';
export * from './components/VATCustomerComparison';
export * from './components/VATSalesTransactionsTable';