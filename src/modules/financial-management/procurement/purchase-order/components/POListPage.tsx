"use client";

import { useState, useCallback, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePOList } from "../hooks/usePurchaseOrders";
import { POFilters } from "./POFilters";
import { POTable } from "./POTable";

export default function POListPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const { data, loading, error, refetch } = usePOList({ search: debouncedSearch || undefined, status: status || undefined });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Purchase Orders</h1>
        <Button variant="default" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
      <POFilters
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={setStatus}
      />
      <POTable data={data} loading={loading} error={error} />
    </div>
  );
}
