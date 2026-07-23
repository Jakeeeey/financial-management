export type PaymentValidationLine = {
    coaId?: unknown;
    bankId?: unknown;
    checkNo?: unknown;
};

/**
 * Petty Cash and Revolving Fund are cash disbursements, so they do not have
 * a bank account or check number. Unknown account titles intentionally remain
 * bank/check payments so the validation fails closed.
 */
export function isPettyCashAccount(accountTitle?: string | null): boolean {
    const normalizedTitle = (accountTitle || "").trim().toLowerCase();
    return normalizedTitle.includes("petty cash") ||
        normalizedTitle.includes("cash on hand") ||
        normalizedTitle.includes("revolving fund") ||
        normalizedTitle.includes("revolving funds");
}

export function validatePaymentLine(line: PaymentValidationLine, accountTitle?: string | null): string | null {
    if (line.coaId == null || line.coaId === "") {
        return "Please select a GL COA account.";
    }

    if (isPettyCashAccount(accountTitle)) {
        return null;
    }

    if (line.bankId == null || line.bankId === "") {
        return "Please select a bank account.";
    }

    if (String(line.checkNo ?? "").trim() === "") {
        return "Please provide a check number.";
    }

    return null;
}
