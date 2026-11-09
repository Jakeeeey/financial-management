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
