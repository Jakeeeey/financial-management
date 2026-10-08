"use client";

import {useEffect, useState} from "react";
import {searchCPTracer} from "../providers/cpTracerApi";
import type {CPTracerResponse, CPTracerSearch} from "../types";

const EMPTY_RESPONSE: CPTracerResponse = {
    content: [],
    totalElements: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: 25,
};

export function useCPTracer(search: CPTracerSearch, page: number, refreshKey: number) {
    const [data, setData] = useState<CPTracerResponse>(EMPTY_RESPONSE);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const searchKey = JSON.stringify(search);

    useEffect(() => {
        const controller = new AbortController();
        const parsedSearch = JSON.parse(searchKey) as CPTracerSearch;
        let settled = false;
        const loadingTimer = window.setTimeout(() => {
            if (!settled && !controller.signal.aborted) setIsLoading(true);
        }, 0);
        searchCPTracer(parsedSearch, page, controller.signal)
            .then((result) => {
                setData(result);
                setError(null);
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setError(cause instanceof Error ? cause.message : "CP Tracer search failed.");
            })
            .finally(() => {
                settled = true;
                window.clearTimeout(loadingTimer);
                if (!controller.signal.aborted) setIsLoading(false);
            });

        return () => {
            window.clearTimeout(loadingTimer);
            controller.abort();
        };
    }, [searchKey, page, refreshKey]);

    return {data, isLoading, error};
}
