// index.ts
// Barrel export — import from one place:
//   import CWTModule from '@/modules/financial-management/reports/cwt'

// Main module
export { default } from './CWTModule';

// Types
export type {
  RawCWTRow,
  CWTRecord,
  AggregatedEntry,
  CWTMetrics,
} from './types';

// Utils
export {
  formatPeso,
  transformCWTRows,
  aggregateByCustomer,
  deriveMetrics,
  getPageNumbers,
} from './utils';

// Hook
export { useCWT } from './hooks/useCWT';

// Components
export { CWTBarChart } from './components/CWTBarChart';
export { CWTPieChart } from './components/CWTPieChart';
export { CWTRecordsTable } from './components/CTRecordsTable';