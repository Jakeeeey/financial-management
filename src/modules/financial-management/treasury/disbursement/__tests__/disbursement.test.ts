/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Test Suite for Cash Issuance & Disbursement Module
// Verifies Immutability Locks, Refund Summation Integrity, and Condition A/B Mismatches

// Standard Jest typings mock or actual imports
import { Disbursement, PaymentLine } from "../types";
import { sumLineAmounts } from "../../utils/line-amounts";
import {
    isFullyPostedPurchaseOrder,
    isPostedReceivingAmount,
    postedReceivingRowsByPurchaseOrder,
} from "@/app/api/fm/treasury/disbursements/_purchase-order-eligibility";
import {
    normalizeDisbursementStatus,
    resolveDisbursementPaymentState,
} from "@/app/api/fm/treasury/disbursements/route";
import {
    RELEASING_PAYMENT_SCOPE,
    resolveDisbursementUpdateStatus,
} from "../utils/update-scope";
import {
    isPettyCashBankAccount,
    validatePaymentLine,
} from "@/app/api/fm/treasury/disbursements/_payment-method";

// 1. Business Logic Code to Test (Usually resides in controllers/utilities)
export function validateMutation(disbursement: Pick<Disbursement, "isPosted" | "status">) {
    if (Number(disbursement.isPosted) === 1) {
        throw new Error("Cannot modify a transaction that is already Posted to the GL. This record is immutable.");
    }
    if (disbursement.status !== "Draft" && disbursement.status !== "Approved") {
        throw new Error("Only Draft or Approved disbursements can be edited.");
    }
    return true;
}

export function calculatePaidAmount(payments: Pick<PaymentLine, "amount">[]) {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
}

export type ReleasingCondition = "Condition A (Balanced)" | "Condition B (Mismatched)";

export function evaluateReleasingCondition(totalAmount: number, paidAmount: number): ReleasingCondition {
    const diff = Math.abs(totalAmount - paidAmount);
    // Allow minor floating point epsilon (0.01 PHP)
    if (diff <= 0.01) {
        return "Condition A (Balanced)";
    }
    return "Condition B (Mismatched)";
}

// 2. Jest Automated Unit Tests
describe("Disbursement Module Core Business Rules", () => {

    describe("Payment and lifecycle state reconciliation", () => {
        it("keeps an approved voucher approved after a releasing payment-only save", () => {
            expect(resolveDisbursementUpdateStatus(
                "Approved",
                RELEASING_PAYMENT_SCOPE,
                true,
            )).toBe("Approved");
        });

        it("keeps a partially released voucher in its current lifecycle state after a payment-only save", () => {
            expect(resolveDisbursementUpdateStatus(
                "Partially Released",
                RELEASING_PAYMENT_SCOPE,
                true,
            )).toBe("Partially Released");
        });

        it("returns an approved voucher to approval after a normal material edit", () => {
            expect(resolveDisbursementUpdateStatus(
                "Approved",
                "VOUCHER",
                true,
            )).toBe("Submitted");
        });

        it("keeps saved payment allocations distinct from a released status", () => {
            expect(resolveDisbursementPaymentState({
                status: "Approved",
                totalAmount: 1000,
                paidAmount: 1,
                isPosted: 0,
            })).toBe("ALLOCATED");
        });

        it("marks a partial release as released progress", () => {
            expect(resolveDisbursementPaymentState({
                status: "Partially Released",
                totalAmount: 1000,
                paidAmount: 1,
                isPosted: 0,
            })).toBe("PARTIALLY_RELEASED");
        });

        it("marks a fully released and posted voucher as released payment state", () => {
            expect(resolveDisbursementPaymentState({
                status: "POSTED",
                totalAmount: 1000,
                paidAmount: 1000,
                isPosted: 1,
            })).toBe("RELEASED");
        });

        it("normalizes lifecycle status casing for the workflow stepper", () => {
            expect(normalizeDisbursementStatus("partially released")).toBe("Partially Released");
        });
    });

    describe("Bank-specific check requirements", () => {
        const pettyCashBank = {
            bankName: "Petty Cash for Men2",
            accountNumber: "001",
        };
        const regularBank = {
            bankName: "QA Bank",
            accountNumber: "005",
        };

        it("recognizes petty cash from the selected bank/cash account", () => {
            expect(isPettyCashBankAccount(pettyCashBank)).toBe(true);
            expect(isPettyCashBankAccount(regularBank)).toBe(false);
        });

        it("allows a petty-cash bank payment without a check number", () => {
            expect(validatePaymentLine(
                { coaId: 10, bankId: 13, checkNo: "" },
                "Office Expenses",
                pettyCashBank,
            )).toBeNull();
        });

        it("still requires a check number for a regular bank payment", () => {
            expect(validatePaymentLine(
                { coaId: 10, bankId: 5, checkNo: "" },
                "Office Expenses",
                regularBank,
            )).toBe("Please provide a check number.");
        });

        it("does not use a petty-cash GL title to exempt a regular bank", () => {
            expect(validatePaymentLine(
                { coaId: 10, bankId: 5, checkNo: "" },
                "Petty Cash Fund",
                regularBank,
            )).toBe("Please provide a check number.");
        });

        it("requires the bank/cash account before classifying the payment", () => {
            expect(validatePaymentLine(
                { coaId: 10, checkNo: "" },
                "Office Expenses",
            )).toBe("Please select a bank account.");
        });
    });
    
    // --- Rule 1: Immutability Locks ---
    describe("Immutability Locks (isPosted = 1)", () => {
        it("should reject updates and throws error if voucher is already posted to GL", () => {
            const mockPostedVoucher: Pick<Disbursement, "isPosted" | "status"> = {
                isPosted: 1,
                status: "Posted"
            };

            expect(() => validateMutation(mockPostedVoucher)).toThrow(
                "Cannot modify a transaction that is already Posted to the GL. This record is immutable."
            );
        });

        it("should reject updates if voucher status is Released", () => {
            const mockReleasedVoucher: Pick<Disbursement, "isPosted" | "status"> = {
                isPosted: 0,
                status: "Released"
            };

            expect(() => validateMutation(mockReleasedVoucher)).toThrow(
                "Only Draft or Approved disbursements can be edited."
            );
        });

        it("should allow updates if voucher is in Draft status and not posted", () => {
            const mockDraftVoucher: Pick<Disbursement, "isPosted" | "status"> = {
                isPosted: 0,
                status: "Draft"
            };

            expect(validateMutation(mockDraftVoucher)).toBe(true);
        });

        it("should allow updates if voucher is in Approved status and not posted", () => {
            const mockApprovedVoucher: Pick<Disbursement, "isPosted" | "status"> = {
                isPosted: 0,
                status: "Approved"
            };

            expect(validateMutation(mockApprovedVoucher)).toBe(true);
        });
    });

    // --- Rule 2: Refund Summation Integrity ---
    describe("Refund Summation Integrity (Negative Payment Amounts)", () => {
        it("should calculate correct paid amount for positive check values", () => {
            const payments = [
                { amount: 5000 },
                { amount: 2500.50 }
            ];
            expect(calculatePaidAmount(payments)).toBe(7500.50);
        });

        it("should subtract negative payment lines representing refunds, reducing net outflow", () => {
            const payments = [
                { amount: 10000 },
                { amount: -2500 } // Refund
            ];
            expect(calculatePaidAmount(payments)).toBe(7500);
        });

        it("should handle fully refunded outflows resulting in zero net outflow", () => {
            const payments = [
                { amount: 5000 },
                { amount: -5000 } // Full refund
            ];
            expect(calculatePaidAmount(payments)).toBe(0);
        });
    });

    describe("Printable section totals", () => {
        it("should sum payable and payment lines using signed amounts", () => {
            expect(sumLineAmounts([{ amount: 1000 }, { amount: -125.5 }, { amount: 25.25 }])).toBe(899.75);
        });

        it("should return zero for an empty line collection", () => {
            expect(sumLineAmounts([])).toBe(0);
        });

        it("should preserve decimal totals", () => {
            expect(sumLineAmounts([{ amount: 0.1 }, { amount: 0.2 }])).toBeCloseTo(0.3);
        });
    });

    describe("Purchase-order disbursement eligibility", () => {
        it("requires both inventory and amount posting flags", () => {
            expect(isPostedReceivingAmount({ isPosted: 0, is_posted_amounts: 1, is_reverted: 0 })).toBe(false);
            expect(isPostedReceivingAmount({ isPosted: 1, is_posted_amounts: 0, is_reverted: 0 })).toBe(false);
            expect(isPostedReceivingAmount({ isPosted: 1, is_posted_amounts: 1, is_reverted: 1 })).toBe(false);
            expect(isPostedReceivingAmount({ isPosted: 1, is_posted_amounts: 1, is_reverted: 0 })).toBe(true);
        });

        it("keeps only fully posted active receiving rows in the posted PO map", () => {
            const rows = postedReceivingRowsByPurchaseOrder([
                { purchase_order_id: 10, receipt_no: "R-POSTED", isPosted: 1, is_posted_amounts: 1, is_reverted: 0 },
                { purchase_order_id: 10, receipt_no: "R-AMOUNT-PENDING", isPosted: 1, is_posted_amounts: 0, is_reverted: 0 },
                { purchase_order_id: 11, receipt_no: "R-REVERTED", isPosted: 1, is_posted_amounts: 1, is_reverted: 1 },
            ]);

            expect(rows.get(10)).toHaveLength(1);
            expect(rows.get(10)?.[0].receipt_no).toBe("R-POSTED");
            expect(rows.has(11)).toBe(false);
        });

        it("hides the entire receipt when one of its lines is not fully posted", () => {
            const rows = postedReceivingRowsByPurchaseOrder([
                { purchase_order_id: 12, receipt_no: "R-MIXED", isPosted: 1, is_posted_amounts: 1, is_reverted: 0 },
                { purchase_order_id: 12, receipt_no: "R-MIXED", isPosted: 1, is_posted_amounts: 0, is_reverted: 0 },
            ]);

            expect(rows.has(12)).toBe(false);
        });

        it("keeps every line from a fully posted receipt so the full amount is available", () => {
            const rows = postedReceivingRowsByPurchaseOrder([
                { purchase_order_id: 13, receipt_no: "R-FULL", isPosted: 1, is_posted_amounts: 1, is_reverted: 0 },
                { purchase_order_id: 13, receipt_no: "R-FULL", isPosted: 1, is_posted_amounts: 1, is_reverted: 0 },
                { purchase_order_id: 13, receipt_no: "R-PENDING", isPosted: 1, is_posted_amounts: 0, is_reverted: 0 },
            ]);

            expect(rows.get(13)).toHaveLength(2);
            expect(rows.get(13)?.every((row) => row.receipt_no === "R-FULL")).toBe(true);
        });

        it("requires every active CWO receiving row to be fully posted", () => {
            expect(isFullyPostedPurchaseOrder([])).toBe(false);
            expect(isFullyPostedPurchaseOrder([
                { isPosted: 1, is_posted_amounts: 1, is_reverted: 0 },
                { isPosted: 1, is_posted_amounts: 0, is_reverted: 0 },
            ])).toBe(false);
            expect(isFullyPostedPurchaseOrder([
                { isPosted: 1, is_posted_amounts: 1, is_reverted: 0 },
                { isPosted: 1, is_posted_amounts: 1, is_reverted: 0 },
            ])).toBe(true);
        });
    });

    // --- Rule 3: Mismatch Prompt Triggers ---
    describe("Mismatch Prompt Triggers (Condition A vs Condition B)", () => {
        it("should trigger Condition A (Balanced) if paid amount matches total amount exactly", () => {
            const totalAmount = 15000.75;
            const paidAmount = 15000.75;
            expect(evaluateReleasingCondition(totalAmount, paidAmount)).toBe("Condition A (Balanced)");
        });

        it("should trigger Condition A (Balanced) if difference is within floating point epsilon threshold", () => {
            const totalAmount = 1000.00;
            const paidAmount = 1000.005; // Less than 0.01 difference
            expect(evaluateReleasingCondition(totalAmount, paidAmount)).toBe("Condition A (Balanced)");
        });

        it("should trigger Condition B (Mismatched) if paid amount is less than vouchered amount", () => {
            const totalAmount = 12000;
            const paidAmount = 9000; // Partial payment
            expect(evaluateReleasingCondition(totalAmount, paidAmount)).toBe("Condition B (Mismatched)");
        });

        it("should trigger Condition B (Mismatched) if paid amount exceeds vouchered amount", () => {
            const totalAmount = 5000;
            const paidAmount = 5500; // Overpayment check
            expect(evaluateReleasingCondition(totalAmount, paidAmount)).toBe("Condition B (Mismatched)");
        });
    });
});
