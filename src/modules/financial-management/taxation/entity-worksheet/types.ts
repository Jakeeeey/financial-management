/** PH taxation desk − shared vocabulary for one company's tax year. */

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
  /** Spring endpoint, when the registry row carries one. Sales come from its itemized view. */
  springUrl: string | null;
  springToken: string | null;
  reachable: boolean;
  unreachableReason: string | null;
}

/** Rates read from the company's own `tax_rates` row, falling back to the built-in defaults. */
export interface TaxRates {
  vat: number;
  percentage: number;
  corporate: number;
  smallCorporate: number;
  mcit: number;
  osd: number;
  scit: number;
  withholding: number;
  /** Both tests have to pass for the 20% rate; a past year must use that year's ceilings. */
  smallCorporateNtiCeiling: number;
  smallCorporateAssetCeiling: number;
  /** The 2% minimum applies from this taxable year of operation onwards. */
  mcitStartYear: number;
  source: "DATABASE" | "DEFAULTS";
  /** Which columns the row did not carry, e.g. ["CorporateRate"]. */
  missing: string[];
}

/** Two defensible readings of "cost of sales", both shown rather than one chosen. */
export type CostBasis = "PRODUCT_COST" | "PURCHASES";

export interface TaxScenario {
  basis: CostBasis;
  label: string;
  grossIncome: number[];
  deductions: number[];
  netTaxableIncome: number[];
  taxDue: number[];
  payable: number[];
  annual: {
    grossIncome: number;
    deductions: number;
    netTaxableIncome: number;
    regular: number;
    mcit: number;
    taxDue: number;
    netPosition: number;
  };
  mcitApplied: boolean;
  smallCorporation: boolean;
  rate: number;
}

/** Raw money for one quarter, straight from the company's own tables. */
export interface QuarterFigures {
  sales: number;
  salesVat: number;
  /** Header discounts; the itemized view nets them out of its product totals. */
  discounts: number;
  returns: number;
  returnsVat: number;
  purchases: number;
  purchasesVat: number;
  /** Σ(line quantity × product standard cost), allocated across the quarter by line amount. */
  cogsProductCost: number;
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
  /** Headline scenario (product standard cost) first, then the purchase-order reading. */
  scenarios: TaxScenario[];
  rates: TaxRates;
}

export interface VatComputation {
  outputVat: number[];
  inputVat: number[];
  netVat: number[];
  payable: number[];
  carriedIn: number[];
}

export interface ExpenseTypeRow {
  type: string;
  label: string;
  amount: number;
  deductible: boolean;
}

export interface ExpenseAccountRow {
  title: string;
  type: string;
  amount: number;
}

export interface ExpenseBreakdown {
  /** Everything the disbursement ledger carried for the year. */
  total: number;
  /** The part of it that reaches the return as a deduction. */
  deductible: number;
  rows: ExpenseTypeRow[];
  accounts: ExpenseAccountRow[];
  source: "SPRING";
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
  /** False when the sales register could not be read: the worksheet is unknown, not zero. */
  figuresAvailable: boolean;
  /** Human-readable names of the sources that failed, e.g. "sales invoices". */
  failedSources: string[];
  /** Where the sales figure came from this year: the itemized Spring view or the invoice headers. */
  salesSource: "STT_VIEW" | "INVOICE_LINES" | "INVOICE_HEADERS";
  /** Account-type breakdown behind the deduction line; null when the view could not be read. */
  expenseBreakdown: ExpenseBreakdown | null;
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


