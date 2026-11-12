import { setupRequest } from "./bankReconciliationSetupApi";

export type PeriodHistory = { id: number; bankId: number; periodEnd: string | null; status: "OPEN" | "CLOSED"; version: number; closureId: number | null; revision: number | null; bankName: string; branch: string; maskedAccountNumber: string; companyName: string | null };
export type LifecycleAction = "close" | "reopen" | "next-period";
export type LifecycleCommand = { requestId: string; version: number; reason?: string };
export type LifecycleReceipt = { state: "CLOSED" | "OPEN" | "REVIEW_REQUIRED"; periodId: number; version: number; closureId?: number; revision?: number; carriedCount?: number; blockers?: string[]; message: string };
export const getPeriodHistory = (search = "", page = 1, bankId?: number, signal?: AbortSignal) => setupRequest<{ items: PeriodHistory[]; total: number; page: number; pageSize: number }>(`periods?${new URLSearchParams({ search, page: String(page), pageSize: "25", ...(bankId ? { bankId: String(bankId) } : {}) })}`, "GET", undefined, signal);
export const runLifecycleCommand = (id: number, action: LifecycleAction, command: LifecycleCommand) => setupRequest<LifecycleReceipt>(`periods/${id}/${action}`, "POST", command);
export const getLifecycleReceipt = (id: number, requestId: string) => setupRequest<LifecycleReceipt>(`periods/${id}/lifecycle-requests/${requestId}`);
