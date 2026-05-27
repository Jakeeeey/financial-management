import { z } from "zod";
import * as schemas from "./schemas";

/**
 * Shared types for the Budget Audit Trail module.
 * All core data types are inferred from Zod schemas to ensure single-source-of-truth.
 */

export type BudgetStatus = z.infer<typeof schemas.BudgetStatusSchema>;
export type AuditAction = z.infer<typeof schemas.AuditActionSchema>;
export type BudgetAuditTrail = z.infer<typeof schemas.BudgetAuditTrailSchema>;
export type Division = z.infer<typeof schemas.DivisionSchema>;
export type Department = z.infer<typeof schemas.DepartmentSchema>;

export interface COA {
  coa_id: number;
  account_title: string;
  gl_code?: string;
}

export interface AuditTrailFilters {
  search: string;
  status: BudgetStatus | "";
  user_id: string;
  date_from: string;
  date_to: string;
  division_id: string;
  department_id: string;
  coa_id: string;
}
