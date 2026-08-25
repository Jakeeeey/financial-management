// index.ts
// Barrel export — import from one place:
//   import EWTModule from '@/modules/financial-management/reports/ewt'

// Main module
export { default } from './EWTModule';

// Types
export type {
  RawEWTRow,
  EWTRecord,
  EWTMetrics,
  PieEntry,
  TrendEntry,
  BarEntry,
} from './types';

// Utils
export {
  formatPeso,
  formatDate,
  transformEWTRows,
  buildPieData,
  buildTrendData,
  buildBarData,
  getPageNumbers,
} from './utils';

// Hook
export { useEWT } from './hooks/useEWT';

// Components
export { EWTBarChart } from './components/EWTBarChart';
export { EWTPieChart } from './components/EWTPieChart';
export { EWTTrendChart } from './components/EWTTrendChart';
export { MetricCard } from './components/MetricCard';
export { TransactionTable } from './components/TransactionTable';