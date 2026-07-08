"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PRFilters } from "./PRFilters";
import { PRTable } from "./PRTable";
import { usePRList } from "../hooks/usePRList";

export default function ProcurementRequestPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const query = React.useMemo(
    () => ({
      q: debouncedSearch || undefined,
      status: status !== "all" ? status : undefined,
      page: 1,
      pageSize: 50,
    }),
    [debouncedSearch, status]
  );

  const { rows, total, loading, error, reload } = usePRList(query);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Procurement Requests</h1>
          <p className="text-sm text-muted-foreground">Manage purchase requests</p>
        </div>
        <Button onClick={() => router.push("/fm/procurement/create")}>
          <Plus className="h-4 w-4 mr-1" /> New Request
        </Button>
      </div>

      <PRFilters
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
      />

      <PRTable
        rows={rows}
        loading={loading}
        error={error}
        total={total}
        onView={(id) => router.push(`/fm/procurement/${id}`)}
      />
    </div>
  );
}
