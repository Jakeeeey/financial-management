export interface ExpectedCollectionRecord {
  invoiceId: number;
  invoiceNo: string;
  orderId: string | null;
  customerName: string;
  customerCode: string;
  invoiceDate: string;
  dueDate: string;
  grossAmount: number | null;
  discountAmount: number | null;
  returnAmount: number | null;
  netReceivable: number | null;
  unfulfilledAmount: number | null;
  appliedCreditMemos: number | null;
  appliedDebitMemos: number | null;
  totalPaid: number | null;
  outstandingBalance: number;
  daysOverdue: number | null;
  branch: string | null;
  division: string | null;
  salesman: string | null;
  isPosted: number | null;
}

export interface ExpectedCollectionResponse {
  range: DateRange | null;
  records: ExpectedCollectionRecord[];
}

export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ExpectedCollectionFilters {
  division: string;
  salesman: string;
  customerName: string;
  invoiceNo: string;
}

export interface FilterOptions {
  divisions: string[];
  salesmen: string[];
}

export interface SalesmanDailyPoint {
  date: string;
  label: string;
  amount: number;
}

export interface SalesmanCollectionGroup {
  name: string;
  records: ExpectedCollectionRecord[];
  invoiceCount: number;
  customerCount: number;
  divisions: string[];
  outstandingBalance: number;
  dailyOutstanding: SalesmanDailyPoint[];
}

export const EMPTY_FILTERS: ExpectedCollectionFilters = {
  division: "",
  salesman: "",
  customerName: "",
  invoiceNo: "",
};
