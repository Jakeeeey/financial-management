import { NextRequest, NextResponse } from "next/server";

import { parseApprovalSearchQuery, shouldFetchCostStreamInUnifiedSearch, shouldFetchPriceStreamInUnifiedSearch } from "../_approvalSearch";
import {
    addActorNames,
    addSuppliersToRows,
    fetchCostBatchesPage,
    fetchCostRequestsPage,
    fetchPriceBatchesPage,
    fetchPriceRequestsPage,
    getAllCostBatchHeaderIds,
    getAllPriceBatchHeaderIds,
    getBatchHeaderIdsForProductSearch,
    getCostHeaderIdsForProductSearch,
    getCostHeaderIdsForProducts,
    intersectHeaderIds,
    isCostHeaderAccessError,
    type ApprovalFilters,
} from "../_approvalSourceAdapters";
import {
    getBatchHeaderIdsForProducts,
    getSupplierScopedProductIdsForSuppliers,
    resolveSupplierIds,
} from "../_supplierFilters";
import {
    fetchStreamTopRows,
    MAX_UNIFIED_FETCH,
    mergeUnifiedRows,
} from "../_unifiedApprovalMerge";
import {
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    mustBase,
} from "../price-change-batches/_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function norm(value: string | null) {
    const text = String(value ?? "").trim();
    if (!text || text === "undefined" || text === "null") return "";
    return text;
}

export async function GET(req: NextRequest) {
    try {
        mustBase();
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const status = norm(searchParams.get("status"));
        const supplierIds = resolveSupplierIds(searchParams);
        const q = norm(searchParams.get("q"));
        const dateFrom = norm(searchParams.get("date_from"));
        const dateTo = norm(searchParams.get("date_to"));
        const scope = norm(searchParams.get("scope"));
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 50)));

        const filters: ApprovalFilters = { status, supplierIds, q, dateFrom, dateTo };
        const offset = (page - 1) * pageSize;
        let needed = offset + pageSize;

        const searchParse = q ? parseApprovalSearchQuery(q) : null;
        const includePriceScope = scope !== "cost";
        const includeCostScope = scope !== "price";
        const includePrice = includePriceScope && (!searchParse || shouldFetchPriceStreamInUnifiedSearch(searchParse));
        const includeCost = includeCostScope && (!searchParse || shouldFetchCostStreamInUnifiedSearch(searchParse));
        const includeBatch =
            includePrice &&
            (!searchParse ||
                searchParse.batchHeaderId != null ||
                searchParse.numericId != null ||
                searchParse.textContains != null);
        const includeCostBatch =
            includeCost &&
            (!searchParse ||
                searchParse.costRequestId != null ||
                searchParse.numericId != null ||
                searchParse.textContains != null);
        const includeStandalonePrice =
            includePrice &&
            !(
                searchParse &&
                searchParse.batchHeaderId != null &&
                searchParse.numericId == null &&
                searchParse.priceRequestId == null &&
                searchParse.costRequestId == null
            );

        const supplierProductIds =
            supplierIds.length > 0
                ? await getSupplierScopedProductIdsForSuppliers(supplierIds)
                : undefined;
        let priceBatchHeaderIds: number[] = [];
        if (includeBatch) {
            const allPriceBatchHeaderIds = await getAllPriceBatchHeaderIds();
            if (supplierIds.length > 0) {
                const supplierPriceBatchHeaderIds = supplierProductIds
                    ? await getBatchHeaderIdsForProducts(supplierProductIds)
                    : [];
                priceBatchHeaderIds = intersectHeaderIds(allPriceBatchHeaderIds, supplierPriceBatchHeaderIds);
            } else {
                priceBatchHeaderIds = allPriceBatchHeaderIds;
            }
        }
        let costBatchHeaderIds: number[] = [];
        if (includeCostBatch) {
            try {
                costBatchHeaderIds = supplierProductIds
                    ? await getCostHeaderIdsForProducts(supplierProductIds)
                    : await getAllCostBatchHeaderIds();
            } catch (error: unknown) {
                if (!isCostHeaderAccessError(error)) throw error;
                costBatchHeaderIds = [];
            }
        }
        const batchHeaderIdsFromSearch =
            includeBatch && searchParse?.textContains
                ? await getBatchHeaderIdsForProductSearch(searchParse.textContains)
                : undefined;
        let costHeaderIdsFromSearch: number[] | undefined;
        if (includeCostBatch && searchParse?.textContains) {
            try {
                costHeaderIdsFromSearch = await getCostHeaderIdsForProductSearch(searchParse.textContains);
            } catch (error: unknown) {
                if (!isCostHeaderAccessError(error)) throw error;
                costHeaderIdsFromSearch = [];
            }
        }

        const emptyStreamPage = () => Promise.resolve({ rows: [], total: 0 });

        const fetchBatchTop = includeBatch
            ? (fetchNeeded: number) =>
                  fetchStreamTopRows(
                      (streamOffset, streamLimit) =>
                          fetchPriceBatchesPage(
                              filters,
                              streamOffset,
                              streamLimit,
                              priceBatchHeaderIds,
                              batchHeaderIdsFromSearch,
                          ),
                      fetchNeeded,
                  )
            : emptyStreamPage;

        const fetchPriceTop = includeStandalonePrice
            ? (fetchNeeded: number) =>
                  fetchStreamTopRows(
                      (streamOffset, streamLimit) =>
                          fetchPriceRequestsPage(filters, streamOffset, streamLimit, supplierProductIds),
                      fetchNeeded,
                  )
            : emptyStreamPage;

        const fetchCostTop = includeCost
            ? (fetchNeeded: number) =>
                  fetchStreamTopRows(
                      (streamOffset, streamLimit) =>
                          fetchCostRequestsPage(filters, streamOffset, streamLimit, supplierProductIds),
                      fetchNeeded,
                  )
            : emptyStreamPage;

        const fetchCostBatchTop = includeCostBatch
            ? (fetchNeeded: number) =>
                  fetchStreamTopRows(
                      (streamOffset, streamLimit) =>
                          fetchCostBatchesPage(
                              filters,
                              streamOffset,
                              streamLimit,
                              costBatchHeaderIds,
                              costHeaderIdsFromSearch,
                          ),
                      fetchNeeded,
                  )
            : emptyStreamPage;

        let [batchPage, pricePage, costBatchPage, costPage] = await Promise.all([
            fetchBatchTop(needed),
            fetchPriceTop(needed),
            fetchCostBatchTop(needed),
            fetchCostTop(needed),
        ]);

        let merged = mergeUnifiedRows(batchPage.rows, pricePage.rows, costBatchPage.rows, costPage.rows);
        let data = merged.slice(offset, offset + pageSize);

        const totalCount = batchPage.total + pricePage.total + costBatchPage.total + costPage.total;

        if (
            data.length < pageSize &&
            offset + data.length < totalCount &&
            needed < MAX_UNIFIED_FETCH
        ) {
            needed = Math.min(needed * 2, MAX_UNIFIED_FETCH);
            [batchPage, pricePage, costBatchPage, costPage] = await Promise.all([
                fetchBatchTop(needed),
                fetchPriceTop(needed),
                fetchCostBatchTop(needed),
                fetchCostTop(needed),
            ]);
            merged = mergeUnifiedRows(batchPage.rows, pricePage.rows, costBatchPage.rows, costPage.rows);
            data = merged.slice(offset, offset + pageSize);
        }

        let enrichedData = await addActorNames(data);
        enrichedData = await addSuppliersToRows(enrichedData);

        return NextResponse.json({
            data: enrichedData,
            meta: { total_count: totalCount },
        });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
