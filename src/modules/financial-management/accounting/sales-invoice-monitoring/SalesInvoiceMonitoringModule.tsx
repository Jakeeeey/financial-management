"use client";

import { SalesInvoiceMonitoringFiltersBar } from "./components/SalesInvoiceMonitoringFilters";
import { SalesInvoiceMonitoringTable } from "./components/SalesInvoiceMonitoringTable";
import { useSalesInvoiceMonitoring } from "./hooks/useSalesInvoiceMonitoring";

export default function SalesInvoiceMonitoringModule() {
	const {
		loading,
		error,
		filters,
		onFilterChange,
		applyFilters,
		clearFilters,
		refresh,
		pagedRows,
		salesmanOptions,
		page,
		setPage,
		totalPages,
		totalRows,
		sortBy,
		sortOrder,
		onSortChange,
	} = useSalesInvoiceMonitoring();

	return (
		<div className="p-4 md:p-6 bg-background text-foreground min-h-screen space-y-6 w-full box-border overflow-hidden">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Sales Invoice Monitoring</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Track untransmitted invoices by customer, salesman, amount, and delivery date.
				</p>
			</div>

			<SalesInvoiceMonitoringFiltersBar
				filters={filters}
				salesmanOptions={salesmanOptions}
				isLoading={loading}
				onFilterChange={onFilterChange}
				onApply={applyFilters}
				onClear={clearFilters}
				onRefresh={refresh}
			/>

			<SalesInvoiceMonitoringTable
				rows={pagedRows}
				loading={loading}
				error={error}
				page={page}
				totalPages={totalPages}
				totalRows={totalRows}
				sortBy={sortBy}
				sortOrder={sortOrder}
				onSortChange={onSortChange}
				onPageChange={setPage}
			/>
		</div>
	);
}
