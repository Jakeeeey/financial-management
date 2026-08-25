import type {
	RawSalesInvoiceMonitoringRow,
	SalesInvoiceMonitoringQueryParams,
} from "../types";

const MODULE_API_PATH = "/api/fm/accounting/sales-invoice-monitoring";

function buildListUrl(params: SalesInvoiceMonitoringQueryParams): string {
	const query = new URLSearchParams({
		startDate: params.startDate,
		endDate: params.endDate,
	});

	return `${MODULE_API_PATH}?${query.toString()}`;
}

function normalizeApiError(error: unknown): string {
	if (error instanceof Error) {
		if (error.message.includes("Failed to fetch")) {
			return "Unable to reach Sales Invoice Monitoring API. Please check your connection and try again.";
		}
		return error.message;
	}

	return "Unable to load Sales Invoice Monitoring data.";
}

function extractRows(payload: unknown): RawSalesInvoiceMonitoringRow[] {
	if (Array.isArray(payload)) {
		return payload as RawSalesInvoiceMonitoringRow[];
	}

	if (payload && typeof payload === "object") {
		const candidate = payload as Record<string, unknown>;
		const bag = candidate.data ?? candidate.content ?? candidate.rows ?? candidate.transactions;
		if (Array.isArray(bag)) {
			return bag as RawSalesInvoiceMonitoringRow[];
		}
	}

	return [];
}

export async function listSalesInvoiceMonitoring(
	params: SalesInvoiceMonitoringQueryParams
): Promise<RawSalesInvoiceMonitoringRow[]> {
	try {
		const response = await fetch(buildListUrl(params), {
			method: "GET",
			credentials: "include",
			cache: "no-store",
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Request failed (${response.status})`);
		}

		const payload = (await response.json()) as unknown;
		return extractRows(payload);
	} catch (error: unknown) {
		throw new Error(normalizeApiError(error));
	}
}
