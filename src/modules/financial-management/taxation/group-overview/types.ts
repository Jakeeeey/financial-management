/** PH taxation desk — group vocabulary. Kernel copy plus the group-overview shapes. */

export type TaxRegime = "REGULAR" | "ENHANCED_DEDUCTIONS" | "SCIT" | "INCOME_TAX_HOLIDAY";

export type DeductionMethod = "ITEMIZED" | "OSD";

/** One row of `company_list`, resolved to a usable Directus client. Server-only: carries the token. */
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

/** What the browser is allowed to know about a company: everything above except `token`/`baseUrl`. */
export interface RegistryCompanySummary {
  companyId: number;
  code: string;
  name: string;
  tin: string | null;
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

/**
 * Where a company landed for the year. `UNREADABLE` means its instance never answered
 * or the read failed; `NOT_ENTERED` means it answered and has no transactions at all.
 * Both are absences of data and are reported as such, never as a settled zero.
 */
export type GroupRowStatus = "DUE" | "OVERPAID" | "SETTLED" | "NOT_ENTERED" | "UNREADABLE";

export interface GroupCompanyRow {
  companyId: number;
  code: string;
  name: string;
  reachable: boolean;
  regime: TaxRegime | null;
  grossIncome: number;
  netTaxableIncome: number;
  taxDue: number;
  credits: number;
  /** Positive: still payable. Negative: overpaid. */
  netPosition: number;
  /** VAT for VAT-registered companies; the 3% percentage tax for the rest. */
  vatPayable: number;
  /** Summed from `ewt_amount` on the year's sales invoices — what customers withheld. */
  withholding: number;
  status: GroupRowStatus;
  profileMissing: boolean;
  failure: string | null;
}

export interface GroupTotals {
  taxDue: number;
  /** Tax due on the companies that are still payable, so `taxDueOnPayable − creditsOnPayable = netPayable`. */
  taxDueOnPayable: number;
  /** Credits belonging to those same companies. Credits inside an overpaid company stay there. */
  creditsOnPayable: number;
  netPayable: number;
  overpaid: number;
  vatPayable: number;
  withholding: number;
  companyCount: number;
  readableCompanies: number;
  overpaidCompanies: number;
  unreadableCompanies: number;
}

export interface GroupAttentionItem {
  key: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  companyCode: string;
  title: string;
  detail: string;
}

export interface CarryoverLot {
  id: number;
  companyId: number;
  companyCode: string;
  companyName: string;
  kind: string;
  originYear: number;
  amount: number;
  used: number;
  remaining: number;
  expiresAfterYear: number | null;
}

export interface GroupOverviewData {
  rows: GroupCompanyRow[];
  totals: GroupTotals;
  carryovers: CarryoverLot[];
  /** Set when `tax_carryover_lot` could not be read; the table then shows a notice, not zeros. */
  carryoverNotice: string | null;
  attention: GroupAttentionItem[];
  companies: RegistryCompanySummary[];
}

export interface Paginated<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
}
