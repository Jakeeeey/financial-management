"use client";

import { useState, useCallback, useEffect } from "react";
import { fetchProvider } from "../../providers/fetchProvider";
import { UserDto } from "../../types";

export interface SettlementQueueItem {
    id: number; docNo?: string; salesmanName?: string; operationName?: string;
    collectionDate?: string | number[]; encodedDate?: string | number[];
    pouchAmount?: number; discrepancy?: number; receivableAmount?: number;
    adjustments?: number; collectedByName?: string; crNo?: string; status?: string;
}

export interface PaginatedQueueResponse {
    content: SettlementQueueItem[];
    totalElements: number;
    totalPages: number;
    currentPage: number;
}

export function useSettlementQueue(
    search: string, status: string, collector: string,
    page: number, size: number, sortField: string, sortDir: string
) {
    const [data, setData] = useState<PaginatedQueueResponse>({ content: [], totalElements: 0, totalPages: 0, currentPage: 1 });
    const [isLoading, setIsLoading] = useState(true);
    const [users, setUsers] = useState<UserDto[]>([]); // To populate the Combobox

    const fetchQueue = useCallback(async () => {
        setIsLoading(true);
        try {
            const qs = new URLSearchParams({
                search, status, collector,
                page: page.toString(), size: size.toString(), sortField, sortDir
            }).toString();

            const result = await fetchProvider.get<PaginatedQueueResponse>(`/api/fm/treasury/collections/settlement-queue?${qs}`);
            if (result) setData(result);
        } catch (error) {
            console.error("Failed to fetch paginated queue:", error);
        } finally {
            setIsLoading(false);
        }
    }, [search, status, collector, page, size, sortField, sortDir]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    useEffect(() => {
        fetchProvider.get<UserDto[]>("/api/fm/treasury/users")
            .then(res => setUsers(res || []))
            .catch(console.error);
    }, []);

    return { data, isLoading, users, fetchQueue };
}