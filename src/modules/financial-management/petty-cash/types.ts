import { z } from "zod";

export const PETTY_CASH_ROOT = "/fm/petty-cash";
export const PETTY_CASH_WORKSPACES = {
  onboarding: { title: "Onboarding", description: "Fund requests and registered payees." },
  "onboarding-approval": { title: "Onboarding Approval", description: "Review, approve and fund, or reject new fund requests." },
  disbursement: { title: "Disbursement", description: "Custodian vouchers, receipt details and payment approvals." },
  replenishment: { title: "Replenishment", description: "Cash reconciliation and replenishment requests." },
  "replenishment-approval": { title: "Replenishment Approval", description: "Named-approver review and replenishment posting." },
  "master-list": { title: "Master List", description: "Fund positions, custody and approved fund changes." },
  "cash-count": { title: "Cash Count", description: "Independent physical counts, witnesses and reconciliation." },
  reports: { title: "Reports & Audit Trail", description: "Spending analysis, accounting reports and source audit history." },
} as const;
export type PettyCashWorkspaceKey = keyof typeof PETTY_CASH_WORKSPACES;
export const isPettyCashWorkspace = (key: string): key is PettyCashWorkspaceKey => Object.hasOwn(PETTY_CASH_WORKSPACES, key);

const navigationSchema = z.object({
  id: z.number().int().positive(), slug: z.string(), title: z.string(),
  basePath: z.literal(PETTY_CASH_ROOT), iconName: z.string().nullable(), sort: z.number().int().nullable(),
});
const workspaceSchema = z.object({
  key: z.string().refine(isPettyCashWorkspace), title: z.string(), path: z.string(),
  stage: z.enum(["FOUNDATION", "ONBOARDING", "VOUCHER_DRAFTS", "FUND_APPROVAL", "FUND_MASTER", "VOUCHER_OPERATIONS", "REPLENISHMENT", "REPLENISHMENT_APPROVAL", "CASH_COUNT", "REPORTS"]),
  capabilities: z.array(z.enum(["READ_ONBOARDING", "EDIT_SETTINGS", "MANAGE_PAYEE_PROFILES", "MANAGE_TAX_RULES", "SUBMIT_FUND_REQUEST", "EDIT_PENDING_FUNDS", "DELETE_PENDING_FUNDS", "READ_VOUCHER_DRAFTS", "EDIT_VOUCHER_DRAFTS", "READ_FUND_APPROVALS", "DECIDE_FUND_REQUESTS", "READ_FUND_MASTER", "OPERATE_VOUCHERS", "READ_REPLENISHMENT", "SUBMIT_REPLENISHMENT", "POST_ACCRUAL", "READ_REPLENISHMENT_APPROVALS", "DECIDE_REPLENISHMENT", "READ_CASH_COUNTS", "RECORD_CASH_COUNTS", "REQUEST_FUND_CHANGES", "DECIDE_FUND_CHANGES", "READ_REPORTS", "EXPORT_REPORTS", "GENERATE_CERTIFICATES"])).max(7),
}).refine(item => item.path === `${PETTY_CASH_ROOT}/${item.key}`)
  .refine(item => item.stage === "FOUNDATION" ? item.capabilities.length === 0
    : item.stage === "REPORTS" ? item.key === "reports" && item.capabilities.includes("READ_REPORTS")
    : item.stage === "CASH_COUNT" ? item.key === "cash-count" && item.capabilities.includes("READ_CASH_COUNTS")
    : item.stage === "REPLENISHMENT_APPROVAL" ? item.key === "replenishment-approval" && item.capabilities.includes("READ_REPLENISHMENT_APPROVALS")
    : item.stage === "REPLENISHMENT" ? item.key === "replenishment" && item.capabilities.includes("READ_REPLENISHMENT")
    : item.stage === "ONBOARDING" ? item.key === "onboarding" && item.capabilities.includes("READ_ONBOARDING")
      : item.stage === "VOUCHER_DRAFTS" ? item.key === "disbursement" && item.capabilities.includes("READ_VOUCHER_DRAFTS")
        : item.stage === "FUND_APPROVAL" ? item.key === "onboarding-approval" && item.capabilities.includes("READ_FUND_APPROVALS")
          : item.stage === "VOUCHER_OPERATIONS" ? item.key === "disbursement" && item.capabilities.includes("OPERATE_VOUCHERS")
            : item.key === "master-list" && item.capabilities.includes("READ_FUND_MASTER"));
const contextSchema = z.object({
  actorId: z.number().int().positive(), actorName: z.string(), parent: navigationSchema,
  workspaces: z.array(workspaceSchema).max(8), stage: z.enum(["FOUNDATION", "ONBOARDING", "VOUCHER_DRAFTS"]),
});
export type PettyCashContext = z.infer<typeof contextSchema>;
export function parsePettyCashContext(value: unknown): PettyCashContext {
  const parsed = contextSchema.parse(value);
  if (new Set(parsed.workspaces.map(item => item.key)).size !== parsed.workspaces.length) throw new Error("Duplicate workspace metadata.");
  return parsed;
}
