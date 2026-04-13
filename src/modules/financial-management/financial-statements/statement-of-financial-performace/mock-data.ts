import { FinancialPerformanceResponse } from "./types";

export const MOCK_FINANCIAL_PERFORMANCE_DATA: FinancialPerformanceResponse = {
  summary: {
    grossSales: 2745000.00,
    salesReturns: 126500.00,
    tradeDiscounts: 58400.00,
    badOrders: 22400.00,
    totalDeductions: 207300.00,
    netSales: 2537700.00,
    costOfGoodsSold: 1359500.00,
    cogsBreakdown: {
      beginningInventory: 1380000.00,
      purchases: 1046000.00,
      freightIn: 76500.00,
      purchaseReturns: 0.00,
      endingInventory: 1143000.00,
    },
    grossProfit: 1178200.00,
    operatingExpenses: 300000.00,
    otherExpense: 12000.00,
    otherIncome: 12000.00,
    netOtherIncome: 0.00,
    incomeBeforeTax: 878200.00,
    taxExpense: 219550.00,
    netIncome: 658650.00,
  },
  ratios: {
    grossProfitMargin: 46.4,
    operatingExpenseRatio: 11.8,
    netProfitMargin: 26.0,
    effectiveTaxRate: 25.0,
  },
  entries: [
    // Sales Group
    { id: "e1", type: "Sales", account: "Booking Sales", division: "North", department: "Sales", amount: 1685000.00 },
    { id: "e2", type: "Sales", account: "Site Sales", division: "South", department: "Sales", amount: 942000.00 },
    { id: "e3", type: "Sales", account: "Promo Support Income", division: "North", department: "Sales", amount: 118000.00 },
    // Deductions
    { id: "e4", type: "Contra Revenue", account: "Sales Returns", division: "All", department: "Sales", amount: -126500.00 },
    { id: "e5", type: "Contra Revenue", account: "Trade Discounts", division: "All", department: "Sales", amount: -58400.00 },
    { id: "e6", type: "Contra Revenue", account: "Bad Orders", division: "Central", department: "Audit", amount: -22400.00 },
    
    // COGS Components
    { id: "e7", type: "Purchases / Cost of Sales", account: "Beginning Inventory", division: "Central", department: "Warehouse", amount: -1380000.00 },
    { id: "e8", type: "Purchases / Cost of Sales", account: "Purchases", division: "Central", department: "Purchasing", amount: -1046000.00 },
    { id: "e9", type: "Purchases / Cost of Sales", account: "Freight In", division: "Central", department: "Logistics", amount: -76500.00 },
    { id: "e10", type: "Purchases / Cost of Sales", account: "Ending Inventory", division: "Central", department: "Warehouse", amount: 1143000.00 }, // Credit to COGS (decrease) -> positive for expense reduction? Depending on signage convention. Let's stick with the schema display

    // Operating Expenses
    { id: "e11", type: "Operating Expenses", account: "Salaries and Wages", division: "All", department: "Admin", amount: -120000.00 },
    { id: "e12", type: "Operating Expenses", account: "Rent Expense", division: "All", department: "Admin", amount: -65000.00 },
    { id: "e13", type: "Operating Expenses", account: "Utilities Expense", division: "All", department: "Admin", amount: -42000.00 },
    { id: "e14", type: "Operating Expenses", account: "Delivery and Transportation", division: "All", department: "Logistics", amount: -38000.00 },
    { id: "e15", type: "Operating Expenses", account: "Office Supplies", division: "All", department: "Admin", amount: -20000.00 },
    { id: "e16", type: "Operating Expenses", account: "Repairs and Maintenance", division: "All", department: "Admin", amount: -15000.00 },

    // Other Income / Expense
    { id: "e17", type: "Other Income", account: "Interest Income", division: "North", department: "Accounting", amount: 12000.00 },
    { id: "e18", type: "Other Expense", account: "Bank Charges", division: "North", department: "Accounting", amount: -7000.00 },
    { id: "e19", type: "Other Expense", account: "Loss on Adjustment", division: "North", department: "Accounting", amount: -5000.00 },
  ],
  
  // Comparison Data (Past FS)
  comparisonSummary: {
    grossSales: 2507300.00,
    salesReturns: 120000.00,
    tradeDiscounts: 52000.00,
    badOrders: 26000.00,
    totalDeductions: 198000.00,
    netSales: 2309300.00,
    costOfGoodsSold: 1835000.00,
    cogsBreakdown: {
      beginningInventory: 1320000.00,
      purchases: 980000.00,
      freightIn: 69000.00,
      purchaseReturns: 0.00,
      endingInventory: 534000.00,
    },
    grossProfit: 465000.00,
    operatingExpenses: 290000.00,
    otherExpense: 10000.00,
    otherIncome: 10000.00,
    netOtherIncome: 0.00,
    incomeBeforeTax: 166000.00,
    taxExpense: 16000.00, // Roughly 10% or just arbitrary prior values
    netIncome: 150000.00,
  },
  comparisonRatios: {
    grossProfitMargin: 19.5,
    operatingExpenseRatio: 13.0,
    netProfitMargin: 6.5,
    effectiveTaxRate: 9.6, // actually 16k / 166k
  },
  comparisonEntries: [
    // Operating Expenses for comparison sub-rows
    { id: "c11", type: "Operating Expenses", account: "Salaries and Wages", division: "All", department: "Admin", amount: -118000.00 },
    { id: "c12", type: "Operating Expenses", account: "Rent Expense", division: "All", department: "Admin", amount: -62000.00 },
    { id: "c13", type: "Operating Expenses", account: "Utilities Expense", division: "All", department: "Admin", amount: -41000.00 },
    { id: "c14", type: "Operating Expenses", account: "Delivery and Transportation", division: "All", department: "Logistics", amount: -36000.00 },
    { id: "c15", type: "Operating Expenses", account: "Office Supplies", division: "All", department: "Admin", amount: -18000.00 },
    { id: "c16", type: "Operating Expenses", account: "Repairs and Maintenance", division: "All", department: "Admin", amount: -15000.00 },
    
    // Other Income / Expense comparison
    { id: "c17", type: "Other Income", account: "Interest Income", division: "North", department: "Accounting", amount: 10000.00 },
    { id: "c18", type: "Other Expense", account: "Bank Charges", division: "North", department: "Accounting", amount: -10000.00 },
  ],
};
