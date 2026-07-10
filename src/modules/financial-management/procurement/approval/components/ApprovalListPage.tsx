"use client";

import * as React from "react";
import { PRFilters } from "./PRFilters";
import { PRTable } from "./PRTable";
import { usePRList } from "../hooks/usePRList";

export default function ApprovalListPage() {
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
      <div>
        <h1 className="text-xl font-semibold">Procurement Approval</h1>
        <p className="text-sm text-muted-foreground">Review and approve purchase requests</p>
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
        onSupplierChange={(id, label) => { setSupplierId(id); setSupplierLabel(label); }}
        onDateChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
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
