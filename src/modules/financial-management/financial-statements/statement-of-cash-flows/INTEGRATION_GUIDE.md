# Cash Flow Statement Module - Integration Guide

## 📋 Overview

This module integrates the Spring Boot endpoint `/api/view-fs-report-statement-cash-flow` into your Next.js frontend, following the same patterns as your existing financial statements modules.

## 🏗️ Module Structure

```
statement-of-cash-flows/
├── types/
│   └── cash-flow.schema.ts          # Zod schemas & TypeScript types
├── services/
│   └── cash-flow.service.ts         # API calls & data processing
├── hooks/
│   └── useCashFlowStatement.ts      # State management & data fetching
├── components/
│   ├── CashFlowSummary.tsx          # Summary cards (4 key metrics)
│   └── CashFlowTable.tsx            # Detailed transaction table
├── CashFlowStatementModule.tsx      # Main module component
└── index.ts                         # Exports
```

## 🚀 Quick Start

### 1. Environment Setup

Ensure your `.env.local` has the Spring Boot API URL:

```env
SPRING_API_BASE_URL=http://msi-andrie:8086
```

### 2. Import and Use the Module

```tsx
import { CashFlowStatementModule } from "@/modules/financial-management/financial-statements/statement-of-cash-flows";

export default function FinancialStatementsPage() {
  return (
    <div>
      <CashFlowStatementModule />
    </div>
  );
}
```

### 3. Add to Navigation

Add the module to your navigation menu/sidebar:

```tsx
{
  title: "Cash Flow Statement",
  href: "/financial-statements/cash-flow",
  icon: TrendingUp,
}
```

## 📊 API Integration Details

### Endpoint
```
GET /api/view-fs-report-statement-cash-flow
```

### Query Parameters
- `startDate` (optional): Start date for filtering (ISO format or LocalDate)
- `endDate` (optional): End date for filtering (ISO format or LocalDate)
- `cashFlowActivity` (optional): Filter by activity type ("Operating", "Investing", "Financing")

### Response Structure
```json
{
  "data": [
    {
      "cashFlowActivity": "Operating",
      "transactionDate": "2024-01-15T08:00:00Z",
      "transactionRef": "INV-2024-001",
      "netCashFlow": 150000.50
    }
  ],
  "success": true
}
```

## 🎨 Features

### 1. Summary Cards
- **Operating Activities**: Net cash from core business operations
- **Investing Activities**: Net cash from investments (positive/negative)
- **Financing Activities**: Net cash from financing activities
- **Net Change in Cash**: Total increase/decrease in cash

### 2. Detailed Table
- **Search**: Filter by transaction reference or activity type
- **Sort**: Click column headers to sort by date, activity, or amount
- **Filter**: Dropdown to filter by activity type
- **Export**: Button to export data (placeholder - implement as needed)

### 3. Date Range Presets
- **This Month**: First day of current month to today
- **This Year**: January 1st to today

## 🔄 Data Flow

1. User selects date range → `useCashFlowStatement` hook
2. Hook calls `getCashFlowStatement()` service
3. Service fetches from Spring Boot API
4. Data is validated with Zod schemas
5. Entries are grouped by activity type
6. Summary totals are calculated
7. Components render with processed data

## 🛠️ Customization Options

### Using the Hook Directly

```tsx
import { useCashFlowStatement } from "./statement-of-cash-flows";

function MyCustomComponent() {
  const {
    entries,           // Raw entries array
    groupedEntries,    // Entries grouped by activity
    summary,           // Calculated totals
    isLoading,
    error,
    filters,
    setStartDate,
    setEndDate,
    setCashFlowActivity,
    refresh,
  } = useCashFlowStatement();

  // Your custom logic here
}
```

### Using Service Functions

```tsx
import { 
  getCashFlowStatement, 
  groupCashFlowEntries, 
  calculateCashFlowSummary 
} from "./statement-of-cash-flows";

// Fetch data manually
const entries = await getCashFlowStatement({
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  cashFlowActivity: "Operating"
});

// Group entries
const grouped = groupCashFlowEntries(entries);

// Calculate summary
const summary = calculateCashFlowSummary(entries);
```

## 🎯 Key Implementation Details

### 1. Date Handling
- Accepts both ISO 8601 strings and LocalDate formats
- Spring Boot service handles parsing automatically
- Frontend uses standard HTML5 date inputs

### 2. Activity Type Grouping
Entries are automatically grouped by activity type:
- **Operating**: Contains "operating" in activity name
- **Investing**: Contains "investing" in activity name
- **Financing**: Contains "financing" in activity name
- **Other**: Everything else

### 3. Currency Formatting
- Uses Philippine Peso (PHP) formatting
- Displays negative values in red/rose color
- Positive values in emerald/green color

### 4. Loading States
- Skeleton loaders for summary cards
- Table shows animated placeholders
- Refresh button shows spinner during loading

## 🔧 Troubleshooting

### Issue: "Failed to fetch cash flow statement"
**Solution**: Check that `SPRING_API_BASE_URL` is set correctly in `.env.local`

### Issue: No data showing
**Solution**: 
1. Verify date range is correct
2. Check browser console for API errors
3. Test endpoint directly: `GET http://your-spring-boot-host:8086/api/view-fs-report-statement-cash-flow?startDate=2024-01-01&endDate=2024-12-31`

### Issue: TypeScript errors
**Solution**: Run `npm run typecheck` to verify types are correct

## 📝 Next Steps

1. **Add to your routing**: Create a page that uses `CashFlowStatementModule`
2. **Add navigation link**: Add to your sidebar/menu
3. **Test with real data**: Verify the Spring Boot endpoint returns expected data
4. **Implement export**: Add functionality to export table data to Excel/PDF
5. **Add drill-down**: Click on summary cards to see detailed transactions

## 🔗 Related Modules

This module follows the same pattern as:
- `statement-of-financial-position` (Balance Sheet)
- `statement-of-financial-performace` (Income Statement)
- `trial-balance`

You can use these as references for similar implementations.

## 📞 Support

If you encounter issues:
1. Check the Spring Boot service logs
2. Verify API response matches expected schema
3. Review browser console for errors
4. Check Zod validation errors in console

---

**Module Version**: 1.0.0  
**Last Updated**: 2024-06-09  
**Compatible with**: Next.js 16, React 19, TypeScript 5