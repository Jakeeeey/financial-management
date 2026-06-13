"use client";

import * as React from "react";
import { toast } from "sonner";
import type { BulkActionResult } from "../types";
import * as api from "../providers/pcrApi";
import { applyActionError } from "../../shared/loadErrorState";
import { isUnauthorizedError } from "../../shared/apiHttp";

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

function emptyBulkResult(action: BulkActionResult["action"]): BulkActionResult {
    return { action, successIds: [], failedIds: [], failures: [] };
}

export function usePCRActions(onDone?: () => void, onUnauthorized?: () => void) {
    const [acting, setActing] = React.useState(false);

    const approve = React.useCallback(
        async (request_id: number) => {
            setActing(true);
            try {
                await api.actionCostRequest({ action: "approve", request_id });
                toast.success("Approved and applied.");
                onDone?.();
            } catch (error: unknown) {
                applyActionError(error, "Failed to approve", { onUnauthorized });
            } finally {
                setActing(false);
            }
        },
        [onDone, onUnauthorized],
    );

    const approveMany = React.useCallback(
        async (requestIds: number[]): Promise<BulkActionResult> => {
            const uniqueIds = Array.from(new Set(requestIds)).filter((id) => Number.isFinite(id));

            if (uniqueIds.length === 0) {
                return emptyBulkResult("approve");
            }

            setActing(true);

            const successIds: number[] = [];
            const failedIds: number[] = [];
            const failures: BulkActionResult["failures"] = [];
            let unauthorized = false;

            try {
                for (const request_id of uniqueIds) {
                    try {
                        await api.actionCostRequest({ action: "approve", request_id });
                        successIds.push(request_id);
                    } catch (error: unknown) {
                        if (applyActionError(error, "Request failed", { onUnauthorized })) {
                            unauthorized = isUnauthorizedError(error);
                            break;
                        }
                        failedIds.push(request_id);
                        failures.push({
                            request_id,
                            message: getErrorMessage(error, "Request failed"),
                        });
                    }
                }

                if (!unauthorized) {
                    if (successIds.length > 0 && failedIds.length === 0) {
                        toast.success(`${successIds.length} request(s) approved and applied.`);
                    } else if (failedIds.length > 0) {
                        const successPart =
                            successIds.length > 0 ? `${successIds.length} approved, ` : "";
                        toast.warning(`${successPart}${failedIds.length} failed — see details`);
                    }

                    if (successIds.length > 0) {
                        onDone?.();
                    }
                }

                return { action: "approve", successIds, failedIds, failures, unauthorized };
            } finally {
                setActing(false);
            }
        },
        [onDone, onUnauthorized],
    );

    const cancel = React.useCallback(
        async (request_id: number) => {
            setActing(true);
            try {
                await api.actionCostRequest({ action: "cancel", request_id });
                toast.success("Cancelled.");
                onDone?.();
            } catch (error: unknown) {
                applyActionError(error, "Failed to cancel", { onUnauthorized });
            } finally {
                setActing(false);
            }
        },
        [onDone, onUnauthorized],
    );

    const reject = React.useCallback(
        async (request_id: number, reject_reason: string) => {
            setActing(true);
            try {
                await api.actionCostRequest({ action: "reject", request_id, reject_reason });
                toast.success("Rejected.");
                onDone?.();
            } catch (error: unknown) {
                applyActionError(error, "Failed to reject", { onUnauthorized });
            } finally {
                setActing(false);
            }
        },
        [onDone, onUnauthorized],
    );

    const rejectMany = React.useCallback(
        async (requestIds: number[], reject_reason: string): Promise<BulkActionResult> => {
            const uniqueIds = Array.from(new Set(requestIds)).filter((id) => Number.isFinite(id));

            if (uniqueIds.length === 0) {
                return emptyBulkResult("reject");
            }

            setActing(true);

            const successIds: number[] = [];
            const failedIds: number[] = [];
            const failures: BulkActionResult["failures"] = [];
            let unauthorized = false;

            try {
                for (const request_id of uniqueIds) {
                    try {
                        await api.actionCostRequest({ action: "reject", request_id, reject_reason });
                        successIds.push(request_id);
                    } catch (error: unknown) {
                        if (applyActionError(error, "Request failed", { onUnauthorized })) {
                            unauthorized = isUnauthorizedError(error);
                            break;
                        }
                        failedIds.push(request_id);
                        failures.push({
                            request_id,
                            message: getErrorMessage(error, "Request failed"),
                        });
                    }
                }

                if (!unauthorized) {
                    if (successIds.length > 0 && failedIds.length === 0) {
                        toast.success(`${successIds.length} request(s) rejected.`);
                    } else if (failedIds.length > 0) {
                        const successPart =
                            successIds.length > 0 ? `${successIds.length} rejected, ` : "";
                        toast.warning(`${successPart}${failedIds.length} failed — see details`);
                    }

                    if (successIds.length > 0) {
                        onDone?.();
                    }
                }

                return { action: "reject", successIds, failedIds, failures, unauthorized };
            } finally {
                setActing(false);
            }
        },
        [onDone, onUnauthorized],
    );

    return { acting, approve, approveMany, cancel, reject, rejectMany };
}
