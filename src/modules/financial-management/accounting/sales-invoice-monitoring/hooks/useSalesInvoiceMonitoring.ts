"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listSalesInvoiceMonitoring } from "../providers/fetchProviders";
import type {
  SalesInvoiceMonitoringFilters,
  SalesInvoiceMonitoringRow,
} from "../types";
import {
  getDefaultDateRange,
  mapSalesInvoiceRows,
  PAGE_SIZE,
} from "../utils";

type SortKey = "invoiceNo" | "customerName" | "salesman" | "amount" | "deliveryDate" | "daysLapses";
type SortOrder = "asc" | "desc";

interface UseSalesInvoiceMonitoringReturn {
  loading: boolean;
  error: string | null;
  rows: SalesInvoiceMonitoringRow[];
  pagedRows: SalesInvoiceMonitoringRow[];
  salesmanOptions: string[];
  totalRows: number;
  page: number;
  totalPages: number;
  sortBy: SortKey;
  sortOrder: SortOrder;
  filters: SalesInvoiceMonitoringFilters;
  onFilterChange: (key: keyof SalesInvoiceMonitoringFilters, value: string) => void;
  onSortChange: (key: SortKey) => void;
  applyFilters: () => void;
  clearFilters: () => void;
  setPage: (value: number | ((prev: number) => number)) => void;
  refresh: () => void;
}

export function useSalesInvoiceMonitoring(): UseSalesInvoiceMonitoringReturn {
  const defaultRange = getDefaultDateRange();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SalesInvoiceMonitoringRow[]>([]);
  const [page, setPage] = useState<number>(1);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortKey>("daysLapses");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [filters, setFilters] = useState<SalesInvoiceMonitoringFilters>({
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    search: "",
    salesman: "",
  });

  const [appliedRange, setAppliedRange] = useState({
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rawRows = await listSalesInvoiceMonitoring(appliedRange);
      const mappedRows = mapSalesInvoiceRows(rawRows);
      setRows(mappedRows);
    } catch (fetchError: unknown) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load Sales Invoice Monitoring.";
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedRange]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshKey]);

  const salesmanOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => row.salesman)
          .filter((name) => Boolean(name && name.trim() && name !== "-"))
      )
    ).sort((left, right) => left.localeCompare(right));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const selectedSalesman = filters.salesman.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = !query || (
        row.invoiceNo.toLowerCase().includes(query) ||
        row.customerName.toLowerCase().includes(query) ||
        row.salesman.toLowerCase().includes(query) ||
        row.deliveryDate.toLowerCase().includes(query)
      );

      const matchesSalesman = !selectedSalesman ||
        row.salesman.trim().toLowerCase() === selectedSalesman;

      return matchesSearch && matchesSalesman;
    });
  }, [rows, filters.search, filters.salesman]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((left, right) => {
      const orderFactor = sortOrder === "asc" ? 1 : -1;

      if (sortBy === "amount" || sortBy === "daysLapses") {
        return (Number(left[sortBy]) - Number(right[sortBy])) * orderFactor;
      }

      if (sortBy === "deliveryDate") {
        const leftTime = new Date(left.deliveryDate.replace(" ", "T")).getTime() || 0;
        const rightTime = new Date(right.deliveryDate.replace(" ", "T")).getTime() || 0;
        return (leftTime - rightTime) * orderFactor;
      }

      return left[sortBy].localeCompare(right[sortBy]) * orderFactor;
    });
  }, [filteredRows, sortBy, sortOrder]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page, totalPages]);

  const onFilterChange = useCallback((key: keyof SalesInvoiceMonitoringFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === "search" || key === "salesman") {
      setPage(1);
    }
  }, []);

  const onSortChange = useCallback((key: SortKey) => {
    setPage(1);

    if (sortBy === key) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }

    setSortBy(key);
    setSortOrder("desc");
  }, [sortBy]);

  const applyFilters = useCallback(() => {
    setPage(1);
    setAppliedRange({
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  }, [filters.endDate, filters.startDate]);

  const clearFilters = useCallback(() => {
    const range = getDefaultDateRange();

    setPage(1);
    setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      search: "",
      salesman: "",
    });
    setAppliedRange({
      startDate: range.startDate,
      endDate: range.endDate,
    });
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return {
    loading,
    error,
    rows,
    pagedRows,
    salesmanOptions,
    totalRows,
    page,
    totalPages,
    sortBy,
    sortOrder,
    filters,
    onFilterChange,
    onSortChange,
    applyFilters,
    clearFilters,
    setPage,
    refresh,
  };
}
