/** PH taxation desk — shared vocabulary for one company's VAT and withholding year. */

export type PeriodKey = "Q1" | "Q2" | "Q3" | "Q4" | "ANNUAL";

export type TaxRegime = "REGULAR" | "ENHANCED_DEDUCTIONS" | "SCIT" | "INCOME_TAX_HOLIDAY";

export type DeductionMethod = "ITEMIZED" | "OSD";

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

/** The registry row as it may cross to the browser: no endpoint, no token. */
export type CompanyOption = Pick<
  RegistryCompany,
  "companyId" | "code" | "name" | "tin" | "reachable" | "unreachableReason"
>;

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
  /** Money ceilings for the 20% corporation rate, in pesos. */
  smallCorporateNtiCeiling: number;
  smallCorporateAssetCeiling: number;
  /** Taxable year of operations from which MCIT applies. */
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

export interface IntercompanyMatch {
  counterpartyCode: string;
  counterpartyName: string;
  direction: "SOLD_TO" | "BOUGHT_FROM" | "BOTH";
  amount: number;
  months: number[];
  counterpartyMirrors: "MATCHED" | "NOT_FOUND" | "DIFFERENT_AMOUNT" | "UNKNOWN";
  counterpartyAmount: number | null;
}

export interface VatComputation {
  outputVat: number[];
  inputVat: number[];
  netVat: number[];
  payable: number[];
  carriedIn: number[];
}

/** The two BIR forms the monthly withholding section maps to. */
export type WithholdingForm = "0619-E" | "1601-EQ";

/**
 * One calendar month of purchase-order withholding, as the ERP records it.
 *
 * `purchases` and `withheld` are sums of `purchase_order` for the month. `agentDue`
 * and `quarterlyDue` place that recorded amount on the form the month is filed under;
 * neither is a remittance, because this ERP has no remittance ledger.
 */
export interface MonthlyWithholdingRow {
  month: number;
  label: string;
  quarter: PeriodKey;
  quarterEnd: boolean;
  purchases: number;
  withheld: number;
  agentForm: WithholdingForm | null;
  quarterlyForm: WithholdingForm | null;
  agentDue: number | null;
  quarterlyDue: number | null;
}

/** A `tax_2307` row with `direction = "RECEIVED"`. */
export interface CertificateRow {
  id: number | string;
  periodKey: PeriodKey | null;
  periodLabel: string;
  counterpartyName: string;
  counterpartyTin: string | null;
  incomeType: string;
  incomeAmount: number;
  taxRate: number;
  taxWithheld: number;
  dateReceived: string | null;
  sourceRef: string | null;
  remarks: string | null;
}

export interface CertificateSummaryRow {
  quarter: PeriodKey;
  expected: number;
  onCertificates: number;
  difference: number;
}

export interface CertificateRegister {
  rows: CertificateRow[];
  summary: CertificateSummaryRow[];
  notices: string[];
}

/** Company, profile and the quarterly sums the page is built from. */
export interface VatSnapshot {
  company: CompanyOption;
  profile: EntityProfile;
  figures: QuarterFigures[];
  notices: string[];
  /** False when the sales register itself could not be read: the figures are unknown, not zero. */
  figuresAvailable: boolean;
  /** Human-readable names of the sources that failed, e.g. "sales invoices". */
  failedSources: string[];
}

/** The whole `GET /api/fm/taxation/vat-withholding` payload. */
export interface VatWithholdingData {
  companies: CompanyOption[];
  snapshot: VatSnapshot;
  vat: VatComputation;
  monthly: MonthlyWithholdingRow[];
  certificates: CertificateRegister;
}

