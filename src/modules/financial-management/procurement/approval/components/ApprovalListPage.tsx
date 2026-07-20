"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRFilters } from "./PRFilters";
import { PRTable } from "./PRTable";
import { usePRList } from "../hooks/usePRList";

export default function ApprovalListPage() {
  const router = useRouter();
  const [procurementNo, setProcurementNo] = React.useState("");
  const [debouncedProcurementNo, setDebouncedProcurementNo] = React.useState("");
  const [status, setStatus] = React.useState("all");
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
      supplier_name: supplierLabel || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page: 1,
      pageSize: 50,
    }),
    [debouncedProcurementNo, status, supplierLabel, dateFrom, dateTo]
  );

  const { rows, total, loading, error, reload } = usePRList(query);

  const tableSupplierOptions = React.useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const seen = new Set<string>();
    const result: { name: string; id: string }[] = [];
    for (const r of rows) {
      const name = r.supplier_name;
      if (name && !seen.has(name)) {
        seen.add(name);
        result.push({ name, id: name });
      }
    }
    return result;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Procurement Approval</h1>
          <p className="text-sm text-muted-foreground">Review and approve purchase requests</p>
        </div>
        <Button variant="default" size="sm" onClick={() => reload()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <PRFilters
        procurementNo={procurementNo}
        status={status}
        supplierLabel={supplierLabel}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onProcurementNoChange={setProcurementNo}
        onStatusChange={setStatus}
        onSupplierChange={(_id, label) => { setSupplierLabel(label); }}
        onDateChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
        tableSupplierOptions={tableSupplierOptions}
      />

      <PRTable
        rows={rows}
        loading={loading}
        error={error}
        total={total}
        onView={(id) => router.push(`/fm/procurement/approval/${id}`)}
      />
    </div>
  );
}
