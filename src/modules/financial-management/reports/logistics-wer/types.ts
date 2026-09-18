export interface LogisticsWerDispatchPlan {
  id: number;
  docNo: string;
  dispatchDate: string | null;
  timeOfDispatch: string | null;
  driverName: string | null;
  vehicleName: string | null;
  status: string | null;
  remarks: string | null;
  amount: number;
}

export type LogisticsWerDispatchPlanSummary = LogisticsWerDispatchPlan;

export interface LogisticsWerDisbursement {
  id: string;
  remarks: string | null;
  amount: number;
}

export interface LogisticsWerStaff {
  userId: number | null;
  name: string;
  role: string | null;
}

export interface LogisticsWerStopItem {
  name: string;
  quantity: number;
  unit: string | null;
  amount: number;
  brand: string | null;
  category: string | null;
  supplier: string | null;
}

export interface LogisticsWerStop {
  type: string;
  name: string;
  documentNo: string | null;
  documentAmount: number;
  sequence: number | null;
  distance: number | null;
  status: string | null;
  remarks: string | null;
  date: string | null;
  items: LogisticsWerStopItem[];
}

export interface LogisticsWerReportPage {
  content: LogisticsWerDispatchPlanSummary[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  range: {
    startDate: string;
    endDate: string;
  };
}

export interface LogisticsWerDispatchPlanDetail {
  plan: LogisticsWerDispatchPlan;
  disbursements: LogisticsWerDisbursement[];
  staff: LogisticsWerStaff[];
  stops: LogisticsWerStop[];
  disbursementTotal: number;
}
