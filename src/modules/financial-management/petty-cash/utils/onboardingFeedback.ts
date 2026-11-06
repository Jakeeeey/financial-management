import { OnboardingError } from "../providers/onboarding.api";
import { ACCOUNT_ROLES, type AccountRole } from "../onboarding-types";

export type FeedbackField = { field: string; label: string; message: string };

const FIELD_LABELS: Record<string, string> = {
    name: "Name",
    supplierName: "Payee name",
    supplierId: "Registered payee",
    payeeKind: "Payee classification",
    vatRegistered: "VAT status",
    taxAddress: "Registered tax address",
    postalCode: "ZIP code",
    defaultExpenseCoaId: "Default expense account",
    departmentId: "Department",
    custodianId: "Custodian",
    branchId: "Branch",
    fundAccountId: "Fund account",
    fundingAccountId: "Funding account",
    imprestAmount: "Imprest amount",
    perVoucherLimit: "Per-voucher limit",
    approvalThreshold: "Approval threshold",
    version: "Record version",
    policyVersion: "Policy settings",
    remarks: "Remarks",
    reason: "Reason",
    cashConfirmed: "Cash confirmation",
    previewDigest: "Review confirmation",
    previewToken: "Review confirmation",
    newImprest: "New imprest",
    newCustodian: "New custodian",
    newCustodianId: "New custodian",
    change: "Fund change",
    countedCash: "Actual cash counted",
    approverId: "Approver",
    periodEnd: "Period end",
    witnessId: "Witness",
    custodianPresent: "Custodian present",
    zeroConfirmed: "Zero cash confirmation",
    quantities: "Denomination quantities",
    count: "Cash count",
    fundingRequired: "Funding requirement",
    decision: "Decision",
    fundId: "Fund",
    payeeProfileId: "Payee",
    date: "Voucher date",
    particulars: "Particulars",
    lines: "Receipt lines",
    documentType: "Document type",
    receiptNo: "Receipt number",
    expenseCoaId: "Expense account",
    gross: "Gross amount",
    vatIncluded: "VAT inclusion",
    vatRuleId: "VAT rule",
    ewtRuleId: "EWT / ATC rule",
    accounts: "Account mappings",
    usageWarning: "Usage warning",
    usageCritical: "Critical usage",
    staleDays: "Stale voucher days",
    companyId: "Registered company",
    registeredName: "Registered name",
    tin: "TIN",
    address: "Registered address",
    signatoryUserId: "Authorised signatory",
    signatoryTitle: "Signatory title",
    signatoryTin: "Signatory TIN",
    ruleKind: "Tax kind",
    code: "Tax code",
    rate: "Rate",
    effectiveFrom: "Effective from",
    effectiveTo: "Effective to",
    documentTypes: "Document types",
    state: "Verification state",
    sourceReference: "Source reference",
    verificationNote: "Verification notes",
};

const humanize = (field: string) =>
    field
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function onboardingFieldLabel(field: string): string {
    const exact = FIELD_LABELS[field];
    if (exact) return exact;

    if (field.startsWith("accounts.")) {
        const role = field.slice("accounts.".length) as AccountRole;
        return ACCOUNT_ROLES[role] ? `${ACCOUNT_ROLES[role]} account` : "Account mapping";
    }

    const line = field.match(/^lines\.(\d+)\.([^.]+)$/);
    if (line) return `${FIELD_LABELS[line[2]] || humanize(line[2])}, line ${Number(line[1]) + 1}`;

    return humanize(field);
}

export function onboardingFieldErrors(error: Error | null): FeedbackField[] {
    if (!(error instanceof OnboardingError)) return [];
    return Object.entries(error.fields).map(([field, message]) => ({
        field,
        label: onboardingFieldLabel(field),
        message,
    }));
}

export function onboardingFieldError(error: Error | null, field: string): string | undefined {
    return error instanceof OnboardingError ? error.fields[field] : undefined;
}

export function onboardingErrorTitle(error: Error | null, fallback = "Something went wrong"): string {
    if (!(error instanceof OnboardingError)) return fallback;
    if (error.code === "VALIDATION_FAILED" || error.status === 400) return "Check the highlighted fields";
    if (error.code === "CONFLICT" || error.status === 409) return "This record changed";
    if (error.code === "ACCESS_DENIED" || error.status === 403) return "You do not have access to this action";
    if (error.status === 401) return "Your session expired";
    if (error.status === 404) return "This record is no longer available";
    if (error.status === 429) return "Too many attempts";
    if (error.code === "FOUNDATION_UNAVAILABLE" || error.status === 503) return "Petty Cash is temporarily unavailable";
    return fallback;
}
