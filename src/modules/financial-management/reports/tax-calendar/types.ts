// tax-calendar/types/index.ts

export type TaxStatus = 'PENDING' | 'UPCOMING' | 'FILED' | 'PAID' | 'OVERDUE';
export type FilingFrequency = 'Monthly' | 'Quarterly' | 'Annually';

export interface TaxActivity {
  id:                   string;
  title:                string;
  bir_form:             string | null;
  description:          string | null;
  filing_frequency:     FilingFrequency | null;
  due_date_rule:        string | null;
  tax_type:             string;
  due_date:             string;
  actual_filing_date:   string | null;
  payment_date:         string | null;
  amount_paid:          number | null;
  status:               TaxStatus;
  reminder_date:        string | null;
  created_at:           string;
  updated_at:           string;
}

export interface TaxActivityForm {
  title:                string;
  bir_form:             string;
  description:          string;
  filing_frequency:     FilingFrequency;
  due_date_rule:        string;
  tax_type:             string;
  due_date:             string;
  actual_filing_date:   string;
  payment_date:         string;
  amount_paid:          string;
  status:               TaxStatus;
  reminder_date:        string;
  tax_calendar_id?:     string;
}

export const STATUSES: TaxStatus[] = ['PENDING', 'UPCOMING', 'FILED', 'PAID', 'OVERDUE'];
export const FILING_FREQUENCIES: FilingFrequency[] = ['Monthly', 'Quarterly', 'Annually'];

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
  title:              '',
  description:        '',
  tax_type:           '',
  bir_form:           '',
  filing_frequency:   'Monthly',
  due_date_rule:      '',
  due_date:           '',
  actual_filing_date: '',
  payment_date:       '',
  amount_paid:        '',
  status:             'PENDING',
  reminder_date:      '',
};

export const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  UPCOMING: 'bg-orange-50 text-orange-700 border-orange-200',
  FILED:    'bg-blue-50 text-blue-700 border-blue-200',
  PAID:     'bg-green-50 text-green-700 border-green-200',
  OVERDUE:  'bg-red-50 text-red-600 border-red-200',
};