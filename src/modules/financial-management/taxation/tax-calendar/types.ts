/** PH taxation desk — shared vocabulary for one company's tax year. */

export type PeriodKey = "Q1" | "Q2" | "Q3" | "Q4" | "ANNUAL";

export type TaxRegime = "REGULAR" | "ENHANCED_DEDUCTIONS" | "SCIT" | "INCOME_TAX_HOLIDAY";

export type DeductionMethod = "ITEMIZED" | "OSD";

export type WithholdingIncomeType = "RENT" | "FEE" | "SERVICES" | "CONSTRUCTION" | "GOODS" | "OTHER";

/** One row of `company_list`, resolved to a usable Directus client. */
export interface RegistryCompany {
  companyId: number;
  code: string;
  name: string;
  tin: string | null;
  baseUrl: string;
  token: string;
  reachable: boolean;
  unreachableReason: string | null;
}

/** Raw money for one quarter, straight from the company's own tables. */
export interface QuarterFigures {
  sales: number;
  salesVat: number;
  returns: number;
  returnsVat: number;
  purchases: number;
  purchasesVat: number;
  expenses: number;
  cwt: number;
  icSales: number;
  icPurchases: number;
  icSalesByCompany: Record<string, number>;
  icPurchasesByCompany: Record<string, number>;
}

export interface EntityProfile {
  companyId: number;
  taxYear: number;
  assetsExcludingLand: number;
  taxableYearOfOperations: number;
  regime: TaxRegime;
  registeredShare: number;
  deductionMethod: DeductionMethod;
  withholdingAgent: boolean;
  hasTopWithholdingStatus: boolean;
  vatRegistered: boolean;
  efpsGroup: "A" | "B" | "C" | "D" | "E" | "NONE";
  ownsRealProperty: boolean;
  taxAgentFeeRate: number;
  priorYearExcessCredit: number;
  notes: string | null;
}

/** A line of the 1702Q worksheet: what it is, where it came from, and the four quarters. */
export interface WorksheetLine {
  key: string;
  lineNo: string;
  label: string;
  hint?: string;
  section: "INCOME" | "DEDUCTIONS" | "TAX";
  source: "DERIVED" | "COMPUTED";
  values: number[];
  yearValue: number;
  emphasis?: boolean;
}

export interface TaxComputation {
  grossIncome: number[];
  deductions: number[];
  osdAmount: number[];
  nolcoUsed: number[];
  netTaxableIncome: number[];
  taxDue: number[];
  taxCredits: number[];
  payable: number[];
  annual: {
    grossIncome: number;
    deductions: number;
    netTaxableIncome: number;
    taxDue: number;
    taxCredits: number;
    netPosition: number;
  };
  regimeApplied: TaxRegime;
  rateApplied: number;
  smallCorporation: boolean;
  mcitApplied: boolean;
  notices: string[];
}

export interface VatComputation {
  outputVat: number[];
  inputVat: number[];
  netVat: number[];
  payable: number[];
  carriedIn: number[];
}

export interface EntitySnapshot {
  company: RegistryCompany;
  profile: EntityProfile;
  figures: QuarterFigures[];
  computation: TaxComputation;
  vat: VatComputation;
  lines: WorksheetLine[];
  matches: IntercompanyMatch[];
  notices: string[];
}

export interface IntercompanyMatch {
  counterpartyCode: string;
  counterpartyName: string;
  direction: "SOLD_TO" | "BOUGHT_FROM" | "BOTH";
  amount: number;
  months: number[];
  counterpartyMirrors: "MATCHED" | "NOT_FOUND" | "DIFFERENT_AMOUNT" | "UNKNOWN";
  counterpartyAmount: number | null;
}

export interface ArfAttention {
  key: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  module: string;
  title: string;
  detail: string;
  companyCode: string;
  reference: string | null;
}

export interface Paginated<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type CalendarStatus = "PAID" | "DUE" | "OVERDUE" | "UNKNOWN";

export type CalendarCategory = "INCOME" | "VAT" | "WITHHOLDING" | "OTHER";

/** One filing on the group calendar. */
export interface CalendarObligation {
  key: string;
  companyId: number;
  companyCode: string;
  companyName: string;
  formCode: string;
  periodKey: string;
  periodLabel: string;
  category: CalendarCategory;
  dueDate: string;
  estimated: number | null;
  status: CalendarStatus;
  note: string | null;
}

/** One deadline as a month-grid cell draws it: no company id, no internal key. */
export interface CalendarDayItem {
  /** `YYYY-MM-DD`, already moved to the working day by the calendar service. */
  date: string;
  formCode: string;
  companyName: string;
  period: string;
  amount: number | null;
  status: CalendarStatus;
  /** Set only when a source carries the original date; today's payload does not. */
  movedFrom?: string;
}

export interface CalendarFilter {
  companyId: number | null;
  category: string;
  status: string;
  from: string;
  to: string;
}
