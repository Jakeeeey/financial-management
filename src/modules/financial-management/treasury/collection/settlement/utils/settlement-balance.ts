import { SettlementAllocation, UnpaidInvoice } from "../../types";

export const SETTLEMENT_BALANCE_TOLERANCE = 0.01;

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export const getInvoiceRequiredBalance = (invoice: UnpaidInvoice) => Math.max(
    0,
    Number(invoice.remainingBalance ?? invoice.originalAmount ?? 0)
);

export const getInvoiceAppliedForSettlement = (
    allocations: SettlementAllocation[],
    invoiceId: number
) => roundCurrency(
    allocations
        .filter(allocation => allocation.invoiceId === invoiceId)
        .reduce((sum, allocation) => sum + Number(allocation.amountApplied || 0), 0)
);

export const findUnderAllocatedInvoice = (
    invoices: UnpaidInvoice[],
    allocations: SettlementAllocation[]
) => invoices.find(invoice => {
    const required = getInvoiceRequiredBalance(invoice);
    const applied = getInvoiceAppliedForSettlement(allocations, invoice.id);
    return required - applied > SETTLEMENT_BALANCE_TOLERANCE;
});

export const findOverAllocatedInvoice = (
    invoices: UnpaidInvoice[],
    allocations: SettlementAllocation[]
) => invoices.find(invoice => {
    const required = getInvoiceRequiredBalance(invoice);
    const applied = getInvoiceAppliedForSettlement(allocations, invoice.id);
    return applied - required > SETTLEMENT_BALANCE_TOLERANCE;
});

export const getCartBalanceTotals = (
    invoices: UnpaidInvoice[],
    allocations: SettlementAllocation[]
) => {
    const required = roundCurrency(invoices.reduce(
        (sum, invoice) => sum + getInvoiceRequiredBalance(invoice),
        0
    ));
    const applied = roundCurrency(invoices.reduce(
        (sum, invoice) => sum + getInvoiceAppliedForSettlement(allocations, invoice.id),
        0
    ));

    return {
        required,
        applied,
        difference: roundCurrency(required - applied),
    };
};
