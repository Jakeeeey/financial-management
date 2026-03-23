"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ApproveManyResult } from "../types";
import * as api from "../providers/pcrApi";

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export function usePCRActions(onDone?: () => void) {
    const [acting, setActing] = React.useState(false);

    const approve = React.useCallback(
        async (request_id: number) => {
            setActing(true);
            try {
                await api.actionRequest({ action: "approve", request_id });
                toast.success("Approved and applied.");
                onDone?.();
            } catch (error: unknown) {
                toast.error(getErrorMessage(error, "Failed to approve"));
            } finally {
                setActing(false);
            }
        },
        [onDone],
    );

    const approveMany = React.useCallback(
        async (requestIds: number[]): Promise<ApproveManyResult> => {
            const uniqueIds = Array.from(new Set(requestIds)).filter((id) => Number.isFinite(id));

            if (uniqueIds.length === 0) {
                return { successIds: [], failedIds: [] };
            }

            setActing(true);

            const successIds: number[] = [];
            const failedIds: number[] = [];

            try {
                for (const request_id of uniqueIds) {
                    try {
                        await api.actionRequest({ action: "approve", request_id });
                        successIds.push(request_id);
                    } catch {
                        failedIds.push(request_id);
                    }
                }

                if (successIds.length > 0 && failedIds.length === 0) {
                    toast.success(`${successIds.length} request(s) approved and applied.`);
                } else if (successIds.length > 0 && failedIds.length > 0) {
                    toast.warning(
                        `${successIds.length} approved, ${failedIds.length} failed.`,
                    );
                } else {
                    toast.error("Failed to approve selected requests.");
                }

                onDone?.();

                return { successIds, failedIds };
            } finally {
                setActing(false);
            }
        },
        [onDone],
    );

    const cancel = React.useCallback(
        async (request_id: number) => {
            setActing(true);
            try {
                await api.actionRequest({ action: "cancel", request_id });
                toast.success("Cancelled.");
                onDone?.();
            } catch (error: unknown) {
                toast.error(getErrorMessage(error, "Failed to cancel"));
            } finally {
                setActing(false);
            }
        },
        [onDone],
    );

    const reject = React.useCallback(
        async (request_id: number, reject_reason: string) => {
            setActing(true);
            try {
                await api.actionRequest({ action: "reject", request_id, reject_reason });
                toast.success("Rejected.");
                onDone?.();
            } catch (error: unknown) {
                toast.error(getErrorMessage(error, "Failed to reject"));
            } finally {
                setActing(false);
            }
        },
        [onDone],
    );

    return { acting, approve, approveMany, cancel, reject };
}