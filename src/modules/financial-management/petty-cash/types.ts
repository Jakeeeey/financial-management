import { z } from "zod";

export const PETTY_CASH_ROOT = "/fm/petty-cash";
export const PETTY_CASH_WORKSPACES = {
  onboarding: { title: "Onboarding", description: "Fund requests, registered payees, personnel and policy settings." },
  "onboarding-approval": { title: "Onboarding Approval", description: "Independent review of fund establishment and changes." },
  disbursement: { title: "Disbursement", description: "Custodian vouchers, receipt details and independent payment approvals." },
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
  stage: z.enum(["FOUNDATION", "ONBOARDING"]),
  capabilities: z.array(z.enum(["READ_ONBOARDING", "EDIT_SETTINGS", "MANAGE_PAYEE_PROFILES", "MANAGE_TAX_RULES", "SUBMIT_FUND_REQUEST"])).max(5),
}).refine(item => item.path === `${PETTY_CASH_ROOT}/${item.key}`)
  .refine(item => item.stage === "FOUNDATION" ? item.capabilities.length === 0
    : item.key === "onboarding" && item.capabilities.includes("READ_ONBOARDING"));
const contextSchema = z.object({
  actorId: z.number().int().positive(), actorName: z.string(), parent: navigationSchema,
  workspaces: z.array(workspaceSchema).max(8), stage: z.enum(["FOUNDATION", "ONBOARDING"]),
});
export type PettyCashContext = z.infer<typeof contextSchema>;
export function parsePettyCashContext(value: unknown): PettyCashContext {
  const parsed = contextSchema.parse(value);
  if (new Set(parsed.workspaces.map(item => item.key)).size !== parsed.workspaces.length) throw new Error("Duplicate workspace metadata.");
  return parsed;
}
