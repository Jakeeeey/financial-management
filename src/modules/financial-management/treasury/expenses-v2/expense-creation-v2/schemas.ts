import { z } from "zod";

export const expenseFormSchema = z.object({
  expense_date: z.string().min(1, "Expense date is required"),
  payee: z.number({ message: "Payee/Supplier is required" }).min(1, "Payee is required"),
  is_employee: z.boolean().default(false),
  division_id: z.number().nullable().optional(),
  department_id: z.number().nullable().optional(),
  coa_id: z.number({ message: "Chart of account is required" }).min(1, "COA is required"),
  amount: z.number({ message: "Amount is required" }).positive("Amount must be greater than 0"),
  remarks: z.string().optional(),
  receipt_url: z.string().optional(),
});

export const bulkExpenseFormSchema = z.object({
  items: z.array(expenseFormSchema).min(1, "At least one expense item is required"),
});

export const resubmitExpenseSchema = z.object({
  expense_date: z.string().min(1, "Expense date is required"),
  payee: z.number().min(1, "Payee is required"),
  is_employee: z.boolean().default(false),
  division_id: z.number().nullable().optional(),
  department_id: z.number().nullable().optional(),
  coa_id: z.number().min(1, "COA is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  remarks: z.string().optional(),
  receipt_url: z.string().optional(),
  resubmit_notes: z.string().min(1, "Resubmission notes are required"),
});
