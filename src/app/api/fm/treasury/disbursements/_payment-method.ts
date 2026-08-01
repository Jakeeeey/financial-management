export type PaymentValidationLine = {
    coaId?: unknown;
    bankId?: unknown;
    checkNo?: unknown;
};

/**
 * Petty Cash and Revolving Fund do not require a bank account or check number.
 * A selected cash-account identity may still be retained for audit/display.
 * Unknown account titles intentionally remain bank/check payments so validation
 * fails closed.
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

    if (!accountTitle || accountTitle.trim() === "") {
        return "Please select a valid GL COA account.";
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
