import type { AgreementTerms } from "../agreement-types";

export const agreementNumbers = [
  ["commissionRate", "Commission (%)"], ["paymentTermsDays", "Payment terms (days)"], ["exposureLimit", "Exposure limit (PHP, stock at cost)"],
  ["ewtRate", "EWT (%)"], ["priceTolerance", "Price tolerance (%)"],
] as const;
export const agreementChoices = [
  ["settlementFrequency", "Settlement frequency", [["WEEKLY", "Weekly"], ["SEMI_MONTHLY", "Twice a month"], ["MONTHLY", "Monthly"]]],
  ["salesReportFrequency", "Sales report frequency", [["WEEKLY", "Weekly"], ["BIWEEKLY", "Every two weeks"], ["MONTHLY", "Monthly"]]],
  ["shrinkageResponsibility", "Shrinkage responsibility", [["CONSIGNEE", "Consignee"], ["COMPANY", "Our company"]]],
  ["listingFeeSettlement", "Listing-fee settlement method", [["OFFSET", "Deducted from collections"], ["CASH", "Paid in cash"]]],
] as const;
export function emptyAgreementTerms(): AgreementTerms {
  return { commissionRate: null, paymentTermsDays: null, settlementFrequency: null, salesReportFrequency: null, exposureLimit: null,
    shrinkageResponsibility: null, ewtRate: null, priceTolerance: null, listingFeeSettlement: null };
}
export function manilaToday() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}
export function agreementDate(value: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(`${value}T12:00:00+08:00`));
}
