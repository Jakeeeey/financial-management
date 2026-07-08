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

  const [procurementNo, setProcurementNo] = React.useState("");
  const [debouncedProcurementNo, setDebouncedProcurementNo] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [supplierId, setSupplierId] = React.useState("");
  const [supplierLabel, setSupplierLabel] = React.useState<string | null>(null);
  const [dateFrom, setDateFrom] = React.useState<string | null>(null);
  const [dateTo, setDateTo] = React.useState<string | null>(null);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedProcurementNo(procurementNo), 400);
    return () => clearTimeout(timer);
  }, [procurementNo]);

  const query = React.useMemo(
    () => ({
      q: debouncedProcurementNo || undefined,
      status: status !== "all" ? status : undefined,
      supplier_id: supplierId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page: 1,
      pageSize: 50,
    }),
    [debouncedProcurementNo, status, supplierId, dateFrom, dateTo]
  );

  const { rows, total, loading, error, reload } = usePRList(query);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Procurement Requests</h1>
          <p className="text-sm text-muted-foreground">Manage purchase requests</p>
        </div>
        <Button onClick={() => router.push("/fm/procurement/procurement-request/create")}>
          <Plus className="h-4 w-4 mr-1" /> New Request
        </Button>
      </div>

      <PRFilters
        procurementNo={procurementNo}
        status={status}
        supplierId={supplierId}
        supplierLabel={supplierLabel}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onProcurementNoChange={setProcurementNo}
        onStatusChange={setStatus}
        onSupplierChange={(id, label) => {
          setSupplierId(id);
          setSupplierLabel(label);
        }}
        onDateChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
      />

      <PRTable
        rows={rows}
        loading={loading}
        error={error}
        total={total}
        onView={(id) => router.push(`/fm/procurement/procurement-request/${id}`)}
      />
    </div>
  );
}
