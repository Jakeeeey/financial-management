/** PH taxation desk — shared vocabulary for one company's tax year. */

import type { WithholdingIncomeType } from "./constants";

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

/* ------------------------------------------------------------------ */
/* Intercompany ledger                                                 */
/* ------------------------------------------------------------------ */

/** One month of documents between a company and one peer. */
export interface LedgerMonth {
  month: string;
  documents: number;
  base: number;
  vat: number;
  withheld: number;
}

/** Everything one company's own tables say about a single peer, for one year. */
export interface PeerFlow {
  peerCode: string;
  peerName: string;
  documents: number;
  base: number;
  vat: number;
  withheld: number;
  months: LedgerMonth[];
}

export type PairStatus = "MATCHED" | "DIFFERENT" | "MISSING" | "NOT_LINKABLE";

/** A directed company pair: what the seller's invoices say, against what the buyer's orders say. */
export interface IntercompanyPair {
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  invoices: number;
  amount: number;
  vat: number;
  withheld: number;
  reciprocalInvoices: number;
  reciprocalAmount: number | null;
  reciprocalWithheld: number | null;
  status: PairStatus;
  /** Which side has no record at all; null unless the status is MISSING. */
  missingSide: "SELLER" | "BUYER" | null;
}

export type MonthlyDirection = "SALE" | "PURCHASE";

export interface IntercompanyMonthlyRow {
  month: string;
  counterpartyCode: string;
  counterpartyName: string;
  direction: MonthlyDirection;
  documents: number;
  amount: number;
  vat: number;
  withheld: number;
}

export interface IntercompanyPayload {
  companies: RegistryCompany[];
  pairs: IntercompanyPair[];
  monthly: IntercompanyMonthlyRow[];
  notices: string[];
}

/** Derived, never stored: what the doc's rate would withhold against what the ERP recorded. */
export interface WithholdingRow {
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  basis: "SALES_INVOICE" | "PURCHASE_ORDER" | "NONE";
  rate: number | null;
  rateLabel: string;
  base: number;
  expected: number | null;
  recorded: number | null;
  recordedSource: "purchase_order" | "sales_invoice" | null;
  difference: number | null;
  verdict: "MATCHED" | "DIFFERENT" | "NOT_DETERMINABLE";
  incomeType: WithholdingIncomeType | null;
}
