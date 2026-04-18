"use client";

import {useState, useCallback, useEffect} from "react";
import {Disbursement, DisbursementPayload, SupplierDto, DivisionDto, DepartmentDto} from "../types";
import {disbursementProvider} from "../providers/fetchProvider";
import {toast} from "sonner";

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

    // 🚀 NEW FILTER STATES
    const [statusFilter, setStatusFilter] = useState("All");
    const [divisionFilter, setDivisionFilter] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("");
    const [docNoSearch, setDocNoSearch] = useState("");

    const [filterSuppliers, setFilterSuppliers] = useState<SupplierDto[]>([]);
    const [divisions, setDivisions] = useState<DivisionDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);

    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                const [trade, nonTrade, divs, depts] = await Promise.all([
                    disbursementProvider.getSuppliers("Trade"),
                    disbursementProvider.getSuppliers("Non-Trade"),
                    disbursementProvider.getDivisions().catch(() => []),
                    disbursementProvider.getDepartments().catch(() => [])
                ]);
                setFilterSuppliers([...trade, ...nonTrade].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
                setDivisions(divs);
                setDepartments(depts);
            } catch {
                console.error("Failed to load filter data");
            }
        };
        fetchFilterData();
    }, []);

    const fetchList = useCallback(async (
        pageNum: number, type: string, search: string, start: string, end: string,
        status: string, divId: string, deptId: string, docNo: string
    ) => {
        setLoading(true);
        try {
            const response = await disbursementProvider.getDisbursements(pageNum, size, type, search, start, end, status, divId, deptId, docNo);
            setData(response.content);
            setTotalPages(response.totalPages);
        } catch {
            toast.error("Failed to load disbursements");
        } finally {
            setLoading(false);
        }
    }, [size]);

    useEffect(() => {
        fetchList(page, activeType, supplierSearch, startDate, endDate, statusFilter, divisionFilter, departmentFilter, docNoSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, activeType]);

    const applyFilters = () => {
        setPage(0);
        fetchList(0, activeType, supplierSearch, startDate, endDate, statusFilter, divisionFilter, departmentFilter, docNoSearch);
    };

    const clearFilters = () => {
        setSupplierSearch("");
        setStartDate("");
        setEndDate("");
        setStatusFilter("All");
        setDivisionFilter("");
        setDepartmentFilter("");
        setDocNoSearch("");
        setPage(0);
        fetchList(0, activeType, "", "", "", "All", "", "", "");
    };

    const handleTabChange = (type: string) => {
        setActiveType(type);
        setPage(0);
    };

    const create = async (payload: DisbursementPayload) => {
        setActionLoading(true);
        try {
            await disbursementProvider.createDisbursement(payload);
            toast.success("Voucher created successfully");
            applyFilters();
            return true;
        } catch {
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
            toast.success("Voucher updated successfully");
            applyFilters();
            return true;
        } catch (error: unknown) { // 🚀 FIX: Replaced 'any'
            const msg = error instanceof Error ? error.message : "Update failed";
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
            applyFilters();
            return true;
        } catch (error: unknown) { // 🚀 FIX: Replaced 'any'
            const msg = error instanceof Error ? error.message : "Status update failed";
            toast.error(msg);
            return false;
        } finally {
            setActionLoading(false);
        }
    };

    return {
        data,
        loading,
        actionLoading,
        page,
        setPage,
        totalPages,
        activeType,
        handleTabChange,
        supplierSearch,
        setSupplierSearch,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        statusFilter,
        setStatusFilter,
        divisionFilter,
        setDivisionFilter,
        departmentFilter,
        setDepartmentFilter,
        docNoSearch,
        setDocNoSearch,
        filterSuppliers,
        divisions,
        departments,
        applyFilters,
        clearFilters,
        refresh: applyFilters,
        create,
        update,
        changeStatus
    };
}