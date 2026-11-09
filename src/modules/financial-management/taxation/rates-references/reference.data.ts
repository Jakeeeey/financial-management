/**
 * The numbers and rules this desk applies, in one searchable place.
 *
 * Every entry names where it comes from: the FSD (`TAXATION.docx`) or the tax code
 * rule the document cites. Nothing here is computed — the engine reads the constants.
 */

export type ReferenceEntry = {
  key: string;
  label: string;
  value: string;
  note?: string;
};

export type ReferenceGroup = {
  key: string;
  title: string;
  description: string;
  entries: ReferenceEntry[];
};

export const REFERENCE_GROUPS: ReferenceGroup[] = [
  {
    key: "income-tax",
    title: "Corporate income tax",
    description: "Regular, enhanced-deduction, SCIT and holiday regimes, plus the minimum tax.",
    entries: [
      {
        key: "regular",
        label: "Regular corporate income tax",
        value: "25%",
        note: "Of net taxable income.",
      },
      {
        key: "regular-small",
        label: "Reduced rate for small corporations",
        value: "20%",
        note: "Net taxable income at or below ₱5,000,000 and assets excluding land at or below ₱100,000,000.",
      },
      {
        key: "mcit",
        label: "Minimum corporate income tax (MCIT)",
        value: "2% of gross income",
        note: "Applies from the fourth taxable year; the desk takes whichever is higher, regular tax or MCIT.",
      },
      {
        key: "mcit-credit",
        label: "Excess MCIT credit",
        value: "3 years",
        note: "Carried per origin year against future regular income tax.",
      },
      {
        key: "edr",
        label: "Registered · enhanced deductions",
        value: "20% of net income",
        note: "After enhanced deductions: power +100%, direct labour +50%, R&D +100%, training +100%, machinery depreciation +20%.",
      },
      {
        key: "scit",
        label: "Registered · SCIT",
        value: "5% of gross income",
        note: "Special corporate income tax for registered export enterprises.",
      },
      {
        key: "ith",
        label: "Registered · income tax holiday",
        value: "0%",
        note: "No income tax while the holiday runs.",
      },
      {
        key: "osd",
        label: "Optional standard deduction",
        value: "40% of gross income",
        note: "Used instead of itemized deductions when the profile asks for it.",
      },
      {
        key: "nolco",
        label: "NOLCO carry-over",
        value: "3 years",
        note: "5 years for losses of 2020 and 2021.",
      },
    ],
  },
  {
    key: "indirect",
    title: "VAT and percentage tax",
    description: "The 2550Q and 2551Q the desk estimates.",
    entries: [
      { key: "vat", label: "Value-added tax", value: "12%", note: "Output on VATable sales less input on VAT purchases." },
      {
        key: "output",
        label: "Output VAT",
        value: "12/112 of the VAT-inclusive invoice total",
        note: "Sales invoices in this ERP store the VAT inside `total_amount`.",
      },
      {
        key: "input",
        label: "Input VAT",
        value: "VAT on purchases from VAT-registered suppliers",
        note: "Purchase orders carry their own `vat_amount`.",
      },
      {
        key: "carry",
        label: "Excess input VAT",
        value: "Carried quarterly",
        note: "Q1 starts from last year's Q4 excess, then each quarter carries forward.",
      },
      {
        key: "percentage",
        label: "Percentage tax",
        value: "3% of gross receipts",
        note: "For companies not registered for VAT (2551Q).",
      },
    ],
  },
  {
    key: "withholding",
    title: "Expanded withholding",
    description: "What a company withholds when it pays another company in the group.",
    entries: [
      { key: "rent", label: "Rent", value: "5%", note: "On the gross rental." },
      {
        key: "fee",
        label: "Management or professional fee",
        value: "Seller's own rate",
        note: "15%, 10% or 2%, taken from the seller's profile.",
      },
      { key: "services", label: "Services", value: "2%", note: "Including construction contracts." },
      {
        key: "goods",
        label: "Goods",
        value: "1%",
        note: "Only when the buyer is a top withholding agent; otherwise 0%.",
      },
      { key: "none", label: "Buyer does not withhold", value: "0%", note: "Individual payees outside the group." },
      {
        key: "final",
        label: "Final tax on deposit interest",
        value: "20%",
        note: "Withheld by the bank; never part of taxable income.",
      },
    ],
  },
  {
    key: "forms",
    title: "Forms the desk tracks",
    description: "Identifiers used in the calendar, payments and 2307 modules.",
    entries: [
      { key: "1702q", label: "1702Q", value: "Quarterly income tax", note: "Q1–Q3, 60 days after the quarter." },
      { key: "1702", label: "1702", value: "Annual income tax", note: "Filed April 15 of the following year." },
      { key: "2550q", label: "2550Q", value: "Quarterly VAT", note: "25 days after the quarter." },
      { key: "2551q", label: "2551Q", value: "Quarterly percentage tax", note: "25 days after the quarter." },
      { key: "0619e", label: "0619-E", value: "Monthly remittance", note: "First two months of each quarter, 10th." },
      { key: "1601eq", label: "1601-EQ", value: "Quarterly withholding return", note: "Last day of the month after the quarter." },
      { key: "1601c", label: "1601-C", value: "Monthly compensation withholding", note: "10th of the following month." },
      { key: "2307", label: "2307", value: "Certificate of tax withheld", note: "Issued within 20 days after the quarter." },
      { key: "1604c", label: "1604-C / 1604-E", value: "Annual withholding", note: "January 31 and March 1." },
      { key: "sec", label: "SEC eFAST", value: "Annual financial statements", note: "May 29 in 2026." },
    ],
  },
  {
    key: "calendar",
    title: "Deadline rules",
    description: "How the calendar moves a date.",
    entries: [
      {
        key: "efps",
        label: "eFPS group shift",
        value: "Groups A–E file on the 15th down to the 11th",
        note: "The profile records the group; the desk shifts the date accordingly.",
      },
      {
        key: "weekend",
        label: "Non-working day",
        value: "Moved to the next working day",
        note: "The reason is shown on the row so nobody thinks the date was invented.",
      },
      {
        key: "holidays",
        label: "Holidays",
        value: "Proclaimed lists for 2025 and 2026",
        note: "Later years fall back to fixed-date holidays, Holy Week and National Heroes Day.",
      },
      { key: "dec1601", label: "December 1601-C", value: "January 15", note: "The one month with its own rule." },
      { key: "lgu", label: "LGU permit and local business tax", value: "January 20, then quarterly on the 20th" },
      { key: "rpt", label: "Real property tax", value: "March 31, June 30, September 30, December 31" },
    ],
  },
  {
    key: "locks",
    title: "Locks and carryovers",
    description: "What a locked period prevents, and what rolls into the next year.",
    entries: [
      {
        key: "quarter-lock",
        label: "Quarter lock",
        value: "Read-only figures",
        note: "Freezes that quarter's figures, its ledger lines, the profile and the carryovers.",
      },
      { key: "annual-lock", label: "Annual lock", value: "Whole year read-only", note: "Payments and 2307s stay editable." },
      {
        key: "unlock",
        label: "Unlocking",
        value: "A written reason, recorded in the change log",
        note: "The log is an activity trail, not a tamper-proof audit.",
      },
      {
        key: "roll",
        label: "Rolling a year forward",
        value: "Copy the profile, keep origin years",
        note: "NOLCO, excess MCIT, overpayment and excess input VAT keep the year they came from.",
      },
    ],
  },
];
