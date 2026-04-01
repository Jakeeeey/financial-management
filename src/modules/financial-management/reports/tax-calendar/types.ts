// tax-calendar/types/index.ts

export type TaxStatus = 'PENDING' | 'FILED' | 'PAID' | 'OVERDUE';

export interface TaxActivity {
  id:            string;
  title:         string;
  description:   string | null;
  tax_type:      string;
  due_date:      string;
  status:        TaxStatus;
  reminder_date: string | null;
  created_at:    string;
  updated_at:    string;
}

export interface TaxActivityForm {
  title:         string;
  description:   string;
  tax_type:      string;
  due_date:      string;
  status:        TaxStatus;
  reminder_date: string;
}

export const STATUSES: TaxStatus[] = ['PENDING', 'FILED', 'PAID', 'OVERDUE'];

export const TAX_TYPES = [
  'Value Added Tax (VAT)',
  'Expanded Withholding Tax (EWT)',
  'Creditable Withholding Tax (CWT)',
  'Final Withholding Tax (FWT)',
  'Income Tax',
  'Percentage Tax',
  'Documentary Stamp Tax (DST)',
  'Excise Tax',
  'Other',
];

export const EMPTY_FORM: TaxActivityForm = {
  title:         '',
  description:   '',
  tax_type:      '',
  due_date:      '',
  status:        'PENDING',
  reminder_date: '',
};

export const STATUS_STYLE: Record<TaxStatus, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  FILED:   'bg-blue-50 text-blue-700 border-blue-200',
  PAID:    'bg-green-50 text-green-700 border-green-200',
  OVERDUE: 'bg-red-50 text-red-600 border-red-200',
};