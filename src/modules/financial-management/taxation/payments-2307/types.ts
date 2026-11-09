/** PH taxation desk — vocabulary for the Payments & 2307 module. */

export type PeriodKey = "Q1" | "Q2" | "Q3" | "Q4" | "ANNUAL";

export type WithholdingIncomeType = "RENT" | "FEE" | "SERVICES" | "CONSTRUCTION" | "GOODS" | "OTHER";

export type CertificateDirection = "RECEIVED" | "ISSUED";

export type CertificateSource = "MANUAL" | "SALES_INVOICE" | "PURCHASE_ORDER";

/**
 * `UNKNOWN` is not a ledger state: it means the source invoice ledger could not be
 * read, so "Matched" and "Short" would be invented. The route reports it in `notices`.
 */
export type CertificateStatus = "MATCHED" | "SHORT" | "OVER" | "NOT_ENTERED" | "UPCOMING" | "UNKNOWN";

/** One row of `company_list`, resolved to a usable Directus client. Server-side only. */
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

/** The registry row as the browser sees it: no endpoint, no token. */
export interface CompanyOption {
  companyId: number;
  code: string;
  name: string;
  tin: string | null;
}

/** `tax_2307` plus the status derived from the company's own invoice ledger. */
export interface CertificateRow {
  id: number;
  companyId: number;
  taxYear: number;
  periodKey: PeriodKey;
  direction: CertificateDirection;
  counterpartyCompanyId: number | null;
  counterpartyName: string;
  counterpartyTin: string | null;
  incomeType: WithholdingIncomeType;
  incomeAmount: number;
  taxRate: number;
  taxWithheld: number;
  dateReceived: string | null;
  source: CertificateSource;
  sourceRef: string | null;
  remarks: string | null;
  createdAt: string;
  createdBy: number | null;
  status: CertificateStatus;
}

export interface PaymentRow {
  id: number;
  companyId: number;
  taxYear: number;
  periodKey: PeriodKey;
  formCode: string;
  paidOn: string;
  amount: number;
  referenceNo: string | null;
  remarks: string | null;
  createdAt: string;
  createdBy: number | null;
  /** The name from the change log's CREATED row; null when the trail does not name one. */
  createdByName: string | null;
}

export interface PeriodLockRow {
  id: number;
  companyId: number;
  taxYear: number;
  periodKey: PeriodKey;
  lockedAt: string;
  lockedBy: number | null;
  lockedByName: string | null;
  unlockReason: string | null;
  unlockedAt: string | null;
  unlockedBy: number | null;
}

/** What the company's invoices say the certificates for one period should add up to. */
export interface ExpectedPeriod {
  periodKey: PeriodKey;
  direction: CertificateDirection;
  expected: number;
  recorded: number;
  certificateCount: number;
  status: CertificateStatus;
  /** False when the ledger behind this direction could not be read. */
  known: boolean;
}

export interface PrefillResult {
  created: number;
  skipped: number;
  notices: string[];
}

/** Everything the page needs for one company and one year. */
export interface DeskPayload {
  companies: CompanyOption[];
  companyId: number;
  year: number;
  certificates: CertificateRow[];
  payments: PaymentRow[];
  locks: PeriodLockRow[];
  expected: ExpectedPeriod[];
  notices: string[];
}

export interface PrefillRow {
  direction: CertificateDirection;
  periodKey: PeriodKey;
  counterpartyName: string;
  counterpartyTin: string | null;
  incomeAmount: number;
  taxWithheld: number;
}
