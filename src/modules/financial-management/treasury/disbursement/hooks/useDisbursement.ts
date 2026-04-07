import { useState, useCallback, useEffect } from "react";
import { Disbursement, DisbursementPayload, SupplierDto } from "../types";
import { disbursementProvider } from "../providers/fetchProvider";
import { toast } from "sonner";

export function useDisbursement() {
    const [data, setData] = useState<Disbursement[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [page, setPage] = useState(0);
    const [size] = useState(20);
    const [totalPages, setTotalPages] = useState(0);
    const [activeType, setActiveType] = useState<string>("All");

    const [supplierSearch, setSupplierSearch] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [filterSuppliers, setFilterSuppliers] = useState<SupplierDto[]>([]);

    useEffect(() => {
        const fetchAllSuppliers = async () => {
            try {
                const [trade, nonTrade] = await Promise.all([
                    disbursementProvider.getSuppliers("Trade"),
                    disbursementProvider.getSuppliers("Non-Trade")
                ]);
                const combined = [...trade, ...nonTrade].sort((a, b) =>
                    a.supplier_name.localeCompare(b.supplier_name)
                );
                setFilterSuppliers(combined);
            } catch { // 🚀 FIX: Removed unused 'e'
                console.error("Failed to load filter suppliers");
            }
        };
        fetchAllSuppliers();
    }, []);

    const fetchList = useCallback(async (pageNum: number, type: string, search: string, start: string, end: string) => {
        setLoading(true);
        try {
            const response = await disbursementProvider.getDisbursements(pageNum, size, type, search, start, end);
            setData(response.content);
            setTotalPages(response.totalPages);
        } catch { // 🚀 FIX: Removed unused 'error'
            toast.error("Failed to load disbursements");
        } finally {
            setLoading(false);
        }
    }, [size]);

    useEffect(() => {
        fetchList(page, activeType, supplierSearch, startDate, endDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, activeType]);

    const applyFilters = () => {
        setPage(0);
        fetchList(0, activeType, supplierSearch, startDate, endDate);
    };

    const handleTabChange = (type: string) => {
        setActiveType(type);
        setPage(0);
    };

    const create = async (payload: DisbursementPayload) => {
        setActionLoading(true);
        try {
            await disbursementProvider.createDisbursement(payload);
            toast.success("Disbursement created successfully");
            fetchList(0, activeType, supplierSearch, startDate, endDate);
            return true;
        } catch { // 🚀 FIX: Removed unused 'error'
            toast.error("Creation failed");
            return false;
        } finally {
            setActionLoading(false);
        }
    };

    const update = async (id: number, payload: DisbursementPayload) => {
        setActionLoading(true);
        try {
            await disbursementProvider.updateDisbursement(id, payload);
            toast.success("Disbursement updated successfully");
            fetchList(page, activeType, supplierSearch, startDate, endDate);
            return true;
        } catch (error: unknown) { // 🚀 FIX: Changed 'any' to 'unknown'
            const msg = error instanceof Error ? error.message : "Failed to update";
            toast.error(msg);
            return false;
        } finally {
            setActionLoading(false);
        }
    };

    const changeStatus = async (id: number, status: string) => {
        setActionLoading(true);
        try {
            await disbursementProvider.updateStatus(id, status);
            toast.success(`Status updated to ${status}`);
            fetchList(page, activeType, supplierSearch, startDate, endDate);
            return true;
        } catch (error: unknown) { // 🚀 FIX: Changed 'any' to 'unknown'
            const msg = error instanceof Error ? error.message : "Failed to update status";
            toast.error(msg);
            return false;
        } finally {
            setActionLoading(false);
        }
    };

    return {
        data, loading, actionLoading,
        page, setPage, totalPages,
        activeType, handleTabChange,
        supplierSearch, setSupplierSearch,
        startDate, setStartDate,
        endDate, setEndDate,
        update,
        applyFilters,
        filterSuppliers,
        refresh: () => fetchList(page, activeType, supplierSearch, startDate, endDate),
        create, changeStatus
    };
}