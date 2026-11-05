import type {
  PageResult,
  StockMovement,
  StockPositionChoices,
  StockPositionResponse,
} from "../stock-position-types";

export class StockPositionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/fm/consignment/stock-position${path}`, { cache: "no-store", signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new StockPositionError(body?.message || "Unable to load stock position.", response.status);
  return body as T;
}

export function getStockPosition(params: URLSearchParams, signal?: AbortSignal) {
  return request<StockPositionResponse>(`?${params.toString()}`, signal);
}

export function getStockMovements(params: URLSearchParams, signal?: AbortSignal) {
  return request<PageResult<StockMovement>>(`/movements?${params.toString()}`, signal);
}

export function getStockPositionChoices(kind: "agreements" | "products", params: URLSearchParams, signal?: AbortSignal) {
  return request<StockPositionChoices>(`/options/${kind}?${params.toString()}`, signal);
}
