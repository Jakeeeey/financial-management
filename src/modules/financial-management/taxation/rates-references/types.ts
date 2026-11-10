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


/** One effective-dated row of `tax_rate_settings`, as the config screen edits it. */
export interface RateSettingRow {
  rateId: number | null;
  effectiveFrom: string;
  vat: number;
  percentage: number;
  corporate: number;
  smallCorporate: number;
  smallCorporateNtiCeiling: number;
  smallCorporateAssetCeiling: number;
  mcit: number;
  mcitStartYear: number;
  scit: number;
  osd: number;
  finalTaxInterest: number;
  notes: string | null;
}

/** One row of `tax_withholding_rates`: income type crossed with seller tier. */
export interface WithholdingRateRow {
  rateId: number | null;
  incomeType: WithholdingIncomeType;
  rateTier: "LARGE" | "MEDIUM" | "SMALL" | null;
  rate: number;
  requiresTopWithholdingAgent: boolean;
  effectiveFrom: string;
}

export type RateConfigKind = "SETTINGS" | "WITHHOLDING";

export interface RateConfigCompany {
  companyId: number;
  code: string;
  name: string;
}

export interface RateConfig {
  companies: RateConfigCompany[];
  company: RateConfigCompany | null;
  settings: RateSettingRow[];
  withholding: WithholdingRateRow[];
  /** Set when the instance has no rate tables, or refused the read. */
  notice: string | null;
}