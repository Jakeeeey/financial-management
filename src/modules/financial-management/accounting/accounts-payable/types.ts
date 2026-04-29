// types.ts — All TypeScript interfaces for the Accounts Payable module.

export interface RawAPRow {
  disbursementId?:  number;
  docNo?:           string;
  transactionDate?: string;
  supplierId?:      number;
  supplierName?:    string;
  dueDate?:         string;
  daysOverdue?:     number;
  remarks?:         string;
  division?:        string | null;
  divisionName?:    string | null;
  departmentId?:    number | null;
  encoderId?:       number;
  encoderName?:     string;
  approverId?:      number | null;
  approverName?:    string;
  status?:          string;
  isPosted?:        number;
  totalPayable?:    number;
  totalPaid?:       number;
  totalRefunded?:   number;
  outstandingBalance?: number;
  [key: string]:    unknown;
}

export type APStatus = 'Paid' | 'Unpaid' | 'Partially Paid' | 'Overdue' | 'Unpaid | Overdue' | 'Partially Paid | Overdue';

export interface APRecord {
  id:                 string;
  refNo:              string;
  supplier:           string;
  invoiceNo:          string;
  division:           string;
  invoiceDate:        string;
  dueDate:            string;
  amountPayable:      number;
  amountPaid:         number;
  outstandingBalance: number;
  aging:              number | null; // null = no due date, negative = future, 0 = today, positive = past due
  status:             APStatus;
}

export interface AgingBucket {
  range:  string;
  amount: number;
}

export interface SupplierEntry {
  name:  string;
  value: number;
  color: string;
}

export interface StatusEntry {
  name:  string;
  value: number;
  color: string;
}

export interface APMetrics {
  totalPayable:     number;
  totalPaid:        number;
  totalOutstanding: number;
  overdueCount:     number;
  totalRecords:     number;
}