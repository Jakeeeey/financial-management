import { z } from "zod";

export const AuditActionSchema = z.enum([
  "Created",
  "Submitted",
  "Approved",
  "Rejected",
  "Resubmitted",
  "Supplement Requested",
  "Deleted"
]);

export const BudgetStatusSchema = z.enum([
  "Draft",
  "Pending",
  "Approved",
  "Rejected",
  "Deleted"
]);

export const BudgetAuditTrailSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(val => String(val)),
  budget_id: z.union([z.string(), z.number()]).transform(val => String(val)),
  action: AuditActionSchema,
  performed_by: z.object({
    id: z.union([z.string(), z.number()]).transform(val => String(val)),
    name: z.string(),
    role: z.string(),
    avatar: z.string().optional(),
  }),
  performed_at: z.string(),
  previous_status: BudgetStatusSchema.optional().nullable(),
  new_status: BudgetStatusSchema,
  previous_amount: z.number().optional().nullable(),
  new_amount: z.number(),
  remarks: z.string().optional().nullable(),
  
  // Contextual data expanded from budget_id
  coa_name: z.string().optional().default("—"),
  gl_code: z.string().optional().default("—"),
  department_name: z.string().optional().default("—"),
  division_name: z.string().optional().default("—"),
  month: z.number().optional().default(0),
  year: z.number().optional().default(0),
  budget_no: z.string().optional().default("—"),
  entry_type: z.enum(['original', 'supplemental', 'realignment']).optional().default('original'),
  live_status: BudgetStatusSchema.optional().default('Draft'),
  parent_budget_id: z.union([z.string(), z.number()]).optional().nullable().transform(val => val ? String(val) : null),
  parent_budget_no: z.string().optional().nullable().default(null),
  
  // Attachments fetched via bulk lookups matching the standard budgeting module workflow
  attachments: z.array(z.object({
    id: z.union([z.string(), z.number()]).transform(val => String(val)),
    directus_id: z.string().optional(),
    file_name: z.string().optional().default("Attachment"),
    file_size: z.number().optional().default(0),
    file_type: z.string().optional(),
  })).optional().default([]),
});



export const DivisionSchema = z.object({
  division_id: z.number(),
  division_name: z.string(),
});

export const DepartmentSchema = z.object({
  department_id: z.number(),
  department_name: z.string(),
  parent_division: z.number(),
  dept_div_id: z.number().optional(),
});
