import { z } from "zod";

// ─── Shared Schemas ──────────────────────────────────────────────────────────

export const TimestampSchema = z.string().or(z.date()).optional();

// ─── Budget Status Enum ──────────────────────────────────────────────────────

export const BudgetStatusSchema = z.enum(["Draft", "Pending", "Approved", "Rejected", "Deleted"]);
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;

export const EntryTypeSchema = z.enum(["original", "supplemental", "realignment"]);
export type EntryType = z.infer<typeof EntryTypeSchema>;

// ─── Tables ──────────────────────────────────────────────────────────────────

export const UserSchema = z.object({
  user_id: z.number(),
  user_email: z.string().email(),
  user_fname: z.string(),
  user_mname: z.string().nullable().optional(),
  user_lname: z.string(),
  user_position: z.string(),
  user_image: z.string().nullable().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const DivisionSchema = z.object({
  division_id: z.number(),
  division_name: z.string(),
  division_code: z.string().nullable().optional(),
  division_description: z.string().nullable().optional(),
});
export type Division = z.infer<typeof DivisionSchema>;

export const DepartmentSchema = z.object({
  department_id: z.number(),
  department_name: z.string(),
  parent_division: z.number().nullable().optional(),
  department_description: z.string().nullable().optional(),
  dept_div_id: z.number().nullable().optional(),
});
export type Department = z.infer<typeof DepartmentSchema>;

export const COASchema = z.object({
  coa_id: z.number(),
  gl_code: z.string().nullable().optional(),
  account_title: z.string().nullable().optional(),
  status: z.enum(["pending", "approved", "rejected", "inactive"]).optional(),
});
export type COA = z.infer<typeof COASchema>;

export const AttachmentSchema = z.object({
  id: z.number().or(z.string()),
  budget_id: z.number().nullable().optional(),
  directus_id: z.string().nullable().optional(),
  name: z.string(),
  url: z.string(),
  type: z.string().nullable().optional(),
  size: z.number().nullable().optional(),
  uploaded_at: TimestampSchema,
});
export type BudgetAttachment = z.infer<typeof AttachmentSchema>;

export const BudgetSchema = z.object({
  id: z.number().or(z.string()),
  budget_no: z.string(),
  parent_budget_id: z.number().nullable().optional(),
  entry_type: EntryTypeSchema,
  year: z.number(),
  month: z.enum([
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]),
  division_id: z.number().or(DivisionSchema), // Directus might return ID or expanded object
  department_id: z.number().or(DepartmentSchema),
  coa_id: z.number().or(COASchema),
  amount: z.number().or(z.string().transform(v => Number(v))), // DECIMAL in SQL might come as string
  remarks: z.string().nullable().optional(),
  status: BudgetStatusSchema,
  created_by: z.number().or(UserSchema).nullable().optional(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  
  // Extra client/context properties expanded from manual lookup mapping
  division_name: z.string().optional(),
  department_name: z.string().optional(),
  coa_name: z.string().optional(),
  gl_code: z.string().optional(),
  attachments: z.array(z.any()).optional().default([]),
});
export type Budget = z.infer<typeof BudgetSchema>;

export const AuditTrailSchema = z.object({
  id: z.number().or(z.string()),
  budget_id: z.number().or(BudgetSchema),
  action: z.enum([
    "Created", "Submitted", "Approved", "Rejected", "Resubmitted", "Supplement Requested", "Deleted"
  ]),
  previous_status: BudgetStatusSchema.nullable().optional(),
  new_status: BudgetStatusSchema,
  previous_amount: z.number().nullable().optional(),
  new_amount: z.number(),
  remarks: z.string().nullable().optional(),
  performed_by: z.any().nullable().optional(), // Accommodate string id/name sub-objects smoothly
  performed_at: TimestampSchema,
  
  // Context properties for timeline mapping
  coa_name: z.string().optional(),
  gl_code: z.string().optional(),
  department_name: z.string().optional(),
  division_name: z.string().optional(),
  month: z.number().optional(),
  year: z.number().optional(),
  budget_no: z.string().optional(),
  entry_type: z.string().optional(),
  live_status: z.string().optional(),
  attachments: z.array(z.any()).optional().default([]),
});
export type BudgetAuditTrail = z.infer<typeof AuditTrailSchema>;

// ─── Junctions ───────────────────────────────────────────────────────────────

export const DepartmentPerDivisionSchema = z.object({
  id: z.number(),
  division_id: z.number(),
  department_id: z.number().or(DepartmentSchema),
});

export const DepartmentDivisionCOASchema = z.object({
  id: z.number(),
  dept_div_id: z.number(),
  coa_id: z.number().or(COASchema),
});

// ─── API Payload Schemas ─────────────────────────────────────────────────────

export const CreateBudgetPayloadSchema = z.object({
  budget_no: z.string().optional(),
  parent_budget_id: z.number().nullable().optional(),
  entry_type: EntryTypeSchema,
  year: z.number(),
  month: z.number().or(z.string()), // Accepts numeric index or literal string name
  division_id: z.number(),
  department_id: z.number(),
  coa_id: z.number(),
  amount: z.number(),
  remarks: z.string().optional(),
  attachments: z.array(z.any()).optional(), // Files are hard to validate with Zod in frontend
});
export type CreateBudgetPayload = z.infer<typeof CreateBudgetPayloadSchema>;
