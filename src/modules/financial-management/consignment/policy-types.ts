export interface PolicyChoice { id: number; code: string; name: string; status: string; classification: string; eligible: boolean; reason: string | null }
export interface PolicyReadiness { ready: boolean; blockers: { code: string; field: string; message: string }[] }
export interface PolicyDetail { version: number; warehouseBranchId: number | null; warehouseAccountId: number | null; consignmentAccountId: number | null; warehouse: PolicyChoice | null; warehouseAccount: PolicyChoice | null; consignmentAccount: PolicyChoice | null; valuationStatus: string; updatedBy: number | null; updatedAt: string | null; readiness: PolicyReadiness }
export interface PolicyDraft { version: number; warehouseBranchId: number | null; warehouseAccountId: number | null; consignmentAccountId: number | null }
export interface PolicyChoices { items: PolicyChoice[]; page: number; pageSize: number; total: number }
