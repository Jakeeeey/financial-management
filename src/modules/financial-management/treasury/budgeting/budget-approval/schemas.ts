import { z } from "zod";

/**
 * Budget Status enum following business rules
 */
export const BudgetStatusSchema = z.enum(["Draft", "Pending", "Approved", "Rejected", "Deleted"]);

/**
 * Audit Action enum for logging
 */
export const AuditActionSchema = z.enum([
  "Created",
  "Submitted",
  "Approved",
  "Rejected",
  "Resubmitted",
  "Supplement Requested",
  "Deleted"
]);

/**
 * Attachment Schema for budget evidence
 */
export const AttachmentSchema = z.object({
  id: z.union([z.string(), z.number()]),
  directus_id: z.string().nullish(),
  file_name: z.string().nullish(),
  file_type: z.string().nullish(),
  file_size: z.union([z.string(), z.number()]).nullish().transform(val => Number(val ?? 0)),
});

export type BudgetAttachment = z.infer<typeof AttachmentSchema>;

/**
 * Organization Lookups
 */
export const DivisionSchema = z.object({
  division_id: z.number(),
  division_name: z.string(),
});

export const DepartmentSchema = z.object({
  department_id: z.number(),
  department_name: z.string(),
  parent_division: z.number().optional(),
  dept_div_id: z.number().optional(),
});

/**
 * Core Budget Schema for Approval List
 */
export const BudgetApprovalItemSchema = z.object({
  id: z.string().or(z.number()),
  budget_no: z.string().nullish(),
  year: z.number().nullish(),
  month: z.number().nullish(), 
  month_name: z.string().nullish(),
  amount: z.number().nullish().transform(val => val ?? 0),
  status: BudgetStatusSchema.nullish().transform(val => val ?? "Pending"),
  entry_type: z.enum(["original", "supplemental"]).nullish().transform(val => val ?? "original"),
  remarks: z.string().nullish(),
  
  // Relations
  coa_name: z.string().nullish(),
  gl_code: z.string().nullish(),
  division_name: z.string().nullish(),
  department_name: z.string().nullish(),
  division_id: z.number().nullish(),
  department_id: z.number().nullish(),
  
  // Metadata
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  
  // Attachments
  attachments: z.array(AttachmentSchema).nullish().default([]),
});

export type BudgetApprovalItem = z.infer<typeof BudgetApprovalItemSchema>;

/**
 * Payload for Update Actions
 */
export const ApprovalActionPayloadSchema = z.object({
  ids: z.array(z.string().or(z.number())),
  status: BudgetStatusSchema,
  action: AuditActionSchema,
  remarks: z.string().optional(),
});
