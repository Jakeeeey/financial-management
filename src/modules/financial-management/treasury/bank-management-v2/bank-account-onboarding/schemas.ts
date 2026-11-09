import { z } from "zod";

import { ACCOUNT_TYPE_OPTIONS, BANK_STATUSES } from "./constants";
import { phtToday } from "./pht";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BALANCE = 999_999_999_999;

function oneOf(values: readonly string[], message: string) {
  return z.string().refine((value) => values.includes(value), message);
}

const notInFuture = (value: string) => value <= phtToday();

const dateOnly = z.string().regex(DATE_PATTERN, "Choose a date.");
const pastOrToday = dateOnly.refine(notInFuture, "The effective date cannot be in the future.");

const remarksField = z.string().trim().max(500, "Keep the remarks under 500 characters.");

/** Strings the RHF form holds; the route body schema is the trust boundary. */
export const registerAccountFormSchema = z.object({
  bankName: z.string().trim().min(1, "Choose or add a bank.").max(160, "The bank name is too long."),
  branch: z.string().trim().min(1, "Enter the branch.").max(160, "The branch is too long."),
  accountNumber: z.string().trim().min(1, "Enter the account number.").max(64, "The account number is too long."),
  accountName: z.string().trim().min(1, "Enter the account holder.").max(160, "The account holder is too long."),
  accountType: oneOf(ACCOUNT_TYPE_OPTIONS, "Choose the account type."),
  glCoaId: z.string().trim().min(1, "Choose the linked GL account."),
  openingBalance: z
    .string()
    .trim()
    .min(1, "Enter the opening balance.")
    .refine((value) => Number.isFinite(Number(value)), "Enter a number.")
    .refine((value) => Number(value) >= 0, "The opening balance cannot be negative."),
  effectiveDate: pastOrToday,
  remarks: remarksField,
});

export const registerAccountBodySchema = z.object({
  bankName: z.string().trim().min(1, "Choose or add a bank.").max(160, "The bank name is too long."),
  branch: z.string().trim().min(1, "Enter the branch.").max(160, "The branch is too long."),
  accountNumber: z.string().trim().min(1, "Enter the account number.").max(64, "The account number is too long."),
  accountName: z.string().trim().min(1, "Enter the account holder.").max(160, "The account holder is too long."),
  accountType: oneOf(ACCOUNT_TYPE_OPTIONS, "Choose the account type."),
  glCoaId: z.number().int().positive("Choose the linked GL account."),
  openingBalance: z
    .number()
    .finite("Enter a number.")
    .min(0, "The opening balance cannot be negative.")
    .max(MAX_BALANCE, "The opening balance is too large."),
  effectiveDate: pastOrToday,
  remarks: remarksField.optional(),
});

export const updateAccountFormSchema = z.object({
  accountName: z.string().trim().min(1, "Enter the account holder.").max(160, "The account holder is too long."),
  branch: z.string().trim().min(1, "Enter the branch.").max(160, "The branch is too long."),
  accountType: oneOf(ACCOUNT_TYPE_OPTIONS, "Choose the account type."),
  glCoaId: z.string().trim().min(1, "Choose the linked GL account."),
  status: oneOf(BANK_STATUSES, "Choose the account status."),
  effectiveDate: pastOrToday,
});

export const updateAccountBodySchema = z.object({
  accountName: z.string().trim().min(1, "Enter the account holder.").max(160, "The account holder is too long."),
  branch: z.string().trim().min(1, "Enter the branch.").max(160, "The branch is too long."),
  accountType: oneOf(ACCOUNT_TYPE_OPTIONS, "Choose the account type."),
  glCoaId: z.number().int().positive("Choose the linked GL account."),
  status: oneOf(BANK_STATUSES, "Choose the account status."),
  effectiveDate: pastOrToday,
});

export type RegisterAccountFormValues = z.infer<typeof registerAccountFormSchema>;
export type RegisterAccountBody = z.infer<typeof registerAccountBodySchema>;
export type UpdateAccountFormValues = z.infer<typeof updateAccountFormSchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;
