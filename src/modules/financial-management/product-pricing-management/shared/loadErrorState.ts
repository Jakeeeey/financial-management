import { toast } from "sonner";

import { isUnauthorizedError } from "./apiHttp";

export type ActionErrorHandlers = {
    onUnauthorized?: () => void;
    setUnauthorized?: (value: boolean) => void;
};

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export function applyActionError(
    error: unknown,
    fallback: string,
    handlers: ActionErrorHandlers,
): boolean {
    if (isUnauthorizedError(error)) {
        handlers.setUnauthorized?.(true);
        handlers.onUnauthorized?.();
        return true;
    }

    toast.error(getErrorMessage(error, fallback));
    return false;
}

export function applyLoadError(
    error: unknown,
    fallback: string,
    setUnauthorized: (value: boolean) => void,
    setError: (value: string | null) => void,
) {
    if (isUnauthorizedError(error)) {
        setUnauthorized(true);
        setError(null);
        return;
    }

    setUnauthorized(false);
    setError(error instanceof Error && error.message ? error.message : fallback);
}
