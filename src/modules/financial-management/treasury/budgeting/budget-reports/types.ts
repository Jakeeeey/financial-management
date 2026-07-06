export interface Division {
  division_id: number | string;
  division_name: string;
}

export interface Department {
  department_id: number | string;
  department_name: string;
  dept_div_id?: number | string;
}

export interface AllocationReportItem {
  divisionId?: string;
  departmentId?: string;
  coaId?: string;
  divisionName: string;
  department: string;
  accountCode: string;
  accountTitle: string;
  amount: number;
  utilized?: number;
  revisionDate?: string;
  originalAmount?: number;
  revisedAmount?: number;
  actionName?: string;
  performedByUser?: string;
  performedByRole?: string;
  auditStatus?: string;
}
