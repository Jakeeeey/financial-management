import { z } from "zod";
import * as schemas from "./schemas";

/**
 * Re-exporting inferred types from Zod schemas to ensure single-source-of-truth.
 */

export type BudgetStatus = z.infer<typeof schemas.BudgetStatusSchema>;
export type AuditAction = z.infer<typeof schemas.AuditActionSchema>;
export type Budget = z.infer<typeof schemas.BudgetApprovalItemSchema>;
export type Division = z.infer<typeof schemas.DivisionSchema>;
export type Department = z.infer<typeof schemas.DepartmentSchema>;

export interface BudgetApprovalFilters {
  search: string;
  year: string;
  month: string;
  division_id: string;
  department_id: string;
  status: BudgetStatus;
}
