/**
 * Zod contracts for the Cash & Bank Transactions lane.
 *
 * Two layers on purpose: `*FormSchema` validates the strings a form holds (RHF + zodResolver),
 * `*BodySchema` validates the JSON body a route receives (numbers, discriminated on `kind`).
 * The route schemas are the trust boundary; the form schemas only shape the UI's messages.
 */

import { z } from "zod";

import { CREDIT_NATURE_OPTIONS } from "./constants";
import { phtToday } from "./pht";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 999_999_999_999;

const natureValues = CREDIT_NATURE_OPTIONS.map((option) => option.value as string);

/** A stored value that must belong to a fixed picklist. */
function oneOf(values: readonly string[], message: string) {
  return z.string().refine((value) => values.includes(value), message);
}

export function isPositiveAmount(raw: string): boolean {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0;
}

export function isNonNegativeAmount(raw: string): boolean {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0;
}

export function toAmount(raw: string): number {
  return Math.round(Number(raw) * 100) / 100;
}

function isNotFutureDate(value: string): boolean {
  return value <= phtToday();
}

function isNotPastDate(value: string): boolean {
  return value >= phtToday();
}

const amountField = z
  .string()
  .trim()
  .min(1, "Enter the amount.")
  .refine(isPositiveAmount, "Enter an amount greater than zero.");

const valueDateField = z
  .string()
  .regex(DATE_PATTERN, "Choose the value date.")
  .refine(isNotFutureDate, "The value date cannot be in the future.");

const descriptionField = z.string().max(500, "Keep the description within 500 characters.");

// ---------------------------------------------------------------------------
// Form schemas (string inputs)
// ---------------------------------------------------------------------------

export const creditFormSchema = z.object({
  bankAccountId: z.string().min(1, "Choose the bank account."),
  valueDate: valueDateField,
  amount: amountField,
  natureKey: oneOf(natureValues, "Choose the nature of the credit."),
  description: descriptionField,
});

export const debitFormSchema = z.object({
  bankAccountId: z.string().min(1, "Choose the bank account."),
  valueDate: valueDateField,
  amount: amountField,
  expenseCoaId: z.string().min(1, "Choose the expense account."),
  description: descriptionField,
});

export const interestFormSchema = z.object({
  bankAccountId: z.string().min(1, "Choose the bank account."),
  valueDate: valueDateField,
  gross: amountField,
  taxRate: z.string().min(1, "Choose the tax rate."),
  description: descriptionField,
});

export const transferFormSchema = z
  .object({
    sourceBankId: z.string().min(1, "Choose the source account."),
    destinationBankId: z.string().min(1, "Choose the destination account."),
    amount: amountField,
    transferFee: z
      .string()
      .trim()
      .refine((value) => value === "" || isNonNegativeAmount(value), "The fee cannot be negative."),
    valueDate: z
      .string()
      .regex(DATE_PATTERN, "Choose the value date.")
      .refine(isNotPastDate, "The value date cannot be in the past."),
    remarks: descriptionField,
  })
  .refine((values) => values.sourceBankId !== values.destinationBankId, {
    message: "Choose a destination different from the source account.",
    path: ["destinationBankId"],
  });

export type CreditFormValues = z.infer<typeof creditFormSchema>;
export type DebitFormValues = z.infer<typeof debitFormSchema>;
export type InterestFormValues = z.infer<typeof interestFormSchema>;
export type TransferFormValues = z.infer<typeof transferFormSchema>;

// ---------------------------------------------------------------------------
// Route body schemas (numbers)
// ---------------------------------------------------------------------------

const money = z.number().finite().positive("Enter an amount greater than zero.").max(MAX_AMOUNT, "The amount is too large.");
const dateOnly = z.string().regex(DATE_PATTERN, "Choose a date.");
const pastOrToday = dateOnly.refine(isNotFutureDate, "The value date cannot be in the future.");
const todayOrFuture = dateOnly.refine(isNotPastDate, "The value date cannot be in the past.");
const bankAccountId = z.number().int().positive("Choose the bank account.");

export const creditBodySchema = z.object({
  kind: z.literal("CREDIT"),
  bankAccountId,
  valueDate: pastOrToday,
  amount: money,
  natureKey: oneOf(natureValues, "Choose the nature of the credit."),
  description: z.string().max(500).optional(),
});

export const debitBodySchema = z.object({
  kind: z.literal("DEBIT"),
  bankAccountId,
  valueDate: pastOrToday,
  amount: money,
  expenseCoaId: z.number().int().positive("Choose the expense account."),
  description: z.string().max(500).optional(),
});

export const interestBodySchema = z.object({
  kind: z.literal("INTEREST"),
  bankAccountId,
  valueDate: pastOrToday,
  gross: money,
  taxRate: z.number().min(0, "Choose the tax rate.").max(1, "Choose the tax rate."),
  description: z.string().max(500).optional(),
});

export const memoBodySchema = z.discriminatedUnion("kind", [
  creditBodySchema,
  debitBodySchema,
  interestBodySchema,
]);

export const transferBodySchema = z
  .object({
    sourceBankId: bankAccountId,
    destinationBankId: z.number().int().positive("Choose the destination account."),
    amount: money,
    transferFee: z.number().finite().min(0, "The fee cannot be negative.").max(MAX_AMOUNT, "The fee is too large."),
    valueDate: todayOrFuture,
    remarks: z.string().max(500).optional(),
  })
  .refine((body) => body.sourceBankId !== body.destinationBankId, {
    message: "Choose a destination different from the source account.",
    path: ["destinationBankId"],
  });

export const cancelMemoBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Say why the memo is being cancelled.")
    .max(300, "Keep the reason within 300 characters."),
});

export const settleTransferBodySchema = z.object({
  note: z.string().trim().max(300).optional(),
});

export type MemoBody = z.infer<typeof memoBodySchema>;
export type TransferBody = z.infer<typeof transferBodySchema>;

/** Zod issues flattened to `{ field: message }` for the dialog's inline errors. */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.length ? issue.path.join(".") : "_form";
    if (!fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}
