export interface RawSalesInvoiceMonitoringRow {
	salesInvoiceNo?: string;
	invoiceNo?: string;
	invoiceNumber?: string;
	invoice_number?: string;
	invoiceId?: number | string;
	customerName?: string;
	customer?: string;
	salesman?: string;
	salesmanName?: string;
	amount?: number | string;
	totalAmount?: number | string;
	netReceivable?: number | string;
	deliveryDay?: string;
	deliveryDate?: string;
	dueDate?: string;
	calculatedDueDate?: string;
	daysLapses?: number | string;
	daysLapsed?: number | string;
	daysOverdue?: number | string;
	[key: string]: unknown;
}

export interface SalesInvoiceMonitoringRow {
	id: string;
	invoiceNo: string;
	customerName: string;
	salesman: string;
	amount: number;
	deliveryDate: string;
	daysLapses: number;
}

export interface SalesInvoiceMonitoringQueryParams {
	startDate: string;
	endDate: string;
}

export interface SalesInvoiceMonitoringFilters extends SalesInvoiceMonitoringQueryParams {
	search: string;
	salesman: string;
}
