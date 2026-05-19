// src/modules/financial-management/accounting/discount-management/supplier-discounting/components/SupplierDiscountingModule.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilterX, Loader2, PackageSearch, Percent, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useSupplierDiscounting } from "../hooks/useSupplierDiscounting";
import { supplierDiscountingApi } from "../providers/supplierDiscountingApi";
import type {
  SupplierDiscountModuleData,
  SupplierDiscountOption,
  SupplierDiscountProduct,
  SupplierDiscountRule,
} from "../types";

const PRODUCT_PAGE_SIZE = 10;
const RULE_PAGE_SIZE = 5;

type SupplierDiscountingModuleProps = {
  initialModuleData: SupplierDiscountModuleData;
  metadataError?: string | null;
};

/**
 * Formats nullable currency values without showing misleading zeroes.
 */
function money(value: number | null) {
  if (value === null) return "Not set";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Keeps select values serializable while preserving null as the empty option.
 */
function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function discountText(discount: SupplierDiscountOption | null) {
  if (!discount) return "No discount";
  return `${discount.discountType} (${discount.totalPercent.toFixed(2)}%)`;
}

function ProductIdentity({ product }: { product: SupplierDiscountProduct }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{product.productName}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
        {product.productCode ? <span>{product.productCode}</span> : null}
        {product.barcode ? <span>{product.barcode}</span> : null}
      </div>
    </div>
  );
}

function RuleIdentity({ rule }: { rule: SupplierDiscountRule }) {
  return (
    <div className="min-w-0">
      <div className="break-words font-medium leading-snug">{rule.productName}</div>
      <div className="mt-1 break-words text-xs text-muted-foreground">
        {[rule.productCode, rule.barcode].filter(Boolean).join(" / ") || "No product code"}
      </div>
    </div>
  );
}

/**
 * Renders the supplier discounting workspace for product selection and rule maintenance.
 */
export default function SupplierDiscountingModule({
  initialModuleData,
  metadataError,
}: SupplierDiscountingModuleProps) {
  const {
    moduleData,
    selectedSupplier,
    rules,
    productPage,
    selectedProductIds,
    productsLoading,
    productError,
    setProductError,
    rulesLoading,
    moduleDataLoading,
    saving,
    includeChildren,
    setIncludeChildren,
    loadProducts,
    loadRules,
    selectSupplier,
    toggleProduct,
    setSelectedProductIds,
    applyBulkDiscount,
    deleteRule,
    refreshModuleData,
  } = useSupplierDiscounting(initialModuleData);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [discountTypeId, setDiscountTypeId] = useState<number | null>(null);
  const [ruleSearch, setRuleSearch] = useState("");
  const [metadataMessage, setMetadataMessage] = useState(metadataError ?? null);
  const ruleSearchRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [rulePage, setRulePage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [preflighting, setPreflighting] = useState(false);
  const [pendingApplyId, setPendingApplyId] = useState<number | null>(null);
  const [pendingApplyNewCount, setPendingApplyNewCount] = useState(0);
  const selectedSupplierId = selectedSupplier?.id ?? null;
  const supplierFiltersReady = !selectedSupplierId || productPage.filterOptions.supplierId === selectedSupplierId;
  const categoryOptions = useMemo(() => {
    if (!selectedSupplierId) return moduleData.categories;
    return supplierFiltersReady ? productPage.filterOptions.categories : [];
  }, [moduleData.categories, productPage.filterOptions.categories, selectedSupplierId, supplierFiltersReady]);
  const brandOptions = useMemo(() => {
    if (!selectedSupplierId) return moduleData.brands;
    return supplierFiltersReady ? productPage.filterOptions.brands : [];
  }, [moduleData.brands, productPage.filterOptions.brands, selectedSupplierId, supplierFiltersReady]);
  const pendingDeleteRule = useMemo(
    () => (pendingDeleteId ? rules.find((r) => r.id === pendingDeleteId) ?? null : null),
    [pendingDeleteId, rules],
  );

  const visibleProductIds = useMemo(
    () => productPage.products.map((product) => product.productId),
    [productPage.products],
  );
  const allVisibleSelected = visibleProductIds.length > 0
    && visibleProductIds.every((productId) => selectedProductIds.includes(productId));
  const filteredRules = useMemo(() => {
    const query = ruleSearch.trim().toLowerCase();
    if (!query) return rules;

    return rules.filter((rule) =>
      [
        rule.productName,
        rule.productCode,
        rule.barcode,
        rule.categoryName,
        rule.brandName,
        discountText(rule.discount),
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [ruleSearch, rules]);
  const ruleTotalPages = Math.max(1, Math.ceil(filteredRules.length / RULE_PAGE_SIZE));
  const ruleCurrentPage = Math.min(rulePage, ruleTotalPages);
  const paginatedRules = useMemo(() => {
    const start = (ruleCurrentPage - 1) * RULE_PAGE_SIZE;
    return filteredRules.slice(start, start + RULE_PAGE_SIZE);
  }, [filteredRules, ruleCurrentPage]);
  const ruleRangeStart = filteredRules.length === 0 ? 0 : (ruleCurrentPage - 1) * RULE_PAGE_SIZE + 1;
  const ruleRangeEnd = Math.min(ruleCurrentPage * RULE_PAGE_SIZE, filteredRules.length);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts({
        page,
        pageSize: PRODUCT_PAGE_SIZE,
        search,
        categoryId,
        brandId,
        supplierId: selectedSupplierId,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [brandId, categoryId, loadProducts, page, search, selectedSupplierId]);

  useEffect(() => {
    if (rulePage > ruleTotalPages) setRulePage(ruleTotalPages);
  }, [rulePage, ruleTotalPages]);

  useEffect(() => {
    if (!selectedSupplierId || !supplierFiltersReady) return;

    if (categoryId && !categoryOptions.some((category) => category.categoryId === categoryId)) {
      setCategoryId(null);
      setPage(1);
    }

    if (brandId && !brandOptions.some((brand) => brand.brandId === brandId)) {
      setBrandId(null);
      setPage(1);
    }
  }, [brandId, brandOptions, categoryId, categoryOptions, selectedSupplierId, supplierFiltersReady]);

  useEffect(() => {
    setMetadataMessage(metadataError ?? null);
  }, [metadataError]);

  useEffect(() => {
    if (!selectedSupplier) return;

    const timer = window.setTimeout(() => {
      ruleSearchRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedSupplier]);

  /**
   * Selects or clears every product visible on the current product page.
   */
  function toggleCurrentPage(checked: boolean) {
    setSelectedProductIds((current) => {
      if (checked) return Array.from(new Set([...current, ...visibleProductIds]));
      return current.filter((productId) => !visibleProductIds.includes(productId));
    });
  }

  function resetFilters() {
    setSearch("");
    setCategoryId(null);
    setBrandId(null);
    setPage(1);
  }

  async function handleApplyBulkDiscount() {
    if (!selectedSupplier) { toast.error("Select a supplier first"); return; }
    if (!discountTypeId) { toast.error("Select a discount first"); return; }
    if (selectedProductIds.length === 0) { toast.error("Select at least one parent product"); return; }
    if (preflighting) return;

    setPreflighting(true);
    try {
      const preflight = await supplierDiscountingApi.preflightRules({
        supplierId: selectedSupplier.id,
        productIds: selectedProductIds,
      });
      setPendingApplyNewCount(preflight.newLinks.length);
      setPendingApplyId(discountTypeId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to inspect existing supplier discounts");
    } finally {
      setPreflighting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-md border bg-background p-4 shadow-sm">
        {metadataMessage ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>{metadataMessage}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={moduleDataLoading}
              onClick={async () => {
                const loaded = await refreshModuleData();
                if (loaded) setMetadataMessage(null);
              }}
            >
              {moduleDataLoading ? <Loader2 className="size-3 animate-spin" /> : null}
              Retry
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal">Supplier Discounting</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Manage item-level supplier discounts for parent products and apply bulk updates by category or brand.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{moduleData.suppliers.length} trade suppliers</Badge>
            <Badge variant="outline">{moduleData.discountTypes.length} discounts</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium">Supplier</span>
            <SearchableSelect
              className="w-full"
              value={selectedSupplier?.id ? String(selectedSupplier.id) : ""}
              onValueChange={(value) => {
                setRuleSearch("");
                setRulePage(1);
                setDiscountTypeId(null);
                setPage(1);
                selectSupplier(numberValue(value));
              }}
              options={[
                { value: "", label: "Select supplier" },
                ...moduleData.suppliers.map((supplier) => ({
                  value: String(supplier.id),
                  label: supplier.supplierName,
                })),
              ]}
              placeholder="Select supplier"
            />
          </div>

          <div className="grid gap-1.5 text-sm">
            <span className="font-medium">Category</span>
            <SearchableSelect
              className="w-full"
              disabled={saving || !supplierFiltersReady}
              value={categoryId ? String(categoryId) : ""}
              onValueChange={(value) => {
                setCategoryId(numberValue(value));
                setPage(1);
              }}
              options={[
                { value: "", label: "All categories" },
                ...categoryOptions.map((category) => ({
                  value: String(category.categoryId),
                  label: category.categoryName,
                })),
              ]}
              placeholder="All categories"
            />
          </div>

          <div className="grid gap-1.5 text-sm">
            <span className="font-medium">Brand</span>
            <SearchableSelect
              className="w-full"
              disabled={saving || !supplierFiltersReady}
              value={brandId ? String(brandId) : ""}
              onValueChange={(value) => {
                setBrandId(numberValue(value));
                setPage(1);
              }}
              options={[
                { value: "", label: "All brands" },
                ...brandOptions.map((brand) => ({
                  value: String(brand.brandId),
                  label: brand.brandName,
                })),
              ]}
              placeholder="All brands"
            />
          </div>

          <div className="grid gap-1.5 text-sm">
            <span className="font-medium">Discount</span>
            <SearchableSelect
              className="w-full"
              value={discountTypeId ? String(discountTypeId) : ""}
              onValueChange={(value) => setDiscountTypeId(numberValue(value))}
              options={[
                { value: "", label: "Select discount" },
                ...moduleData.discountTypes.map((discount) => ({
                  value: String(discount.id),
                  label: discountText(discount),
                })),
              ]}
              placeholder="Select discount"
            />
          </div>

          <div className="flex items-end gap-2">
            <Button
              type="button"
              className="w-full xl:w-auto"
              disabled={saving || preflighting || selectedProductIds.length === 0 || !discountTypeId}
              title={
                selectedProductIds.length === 0
                  ? "Select at least one product to apply a discount"
                  : !discountTypeId
                    ? "Select a discount type first"
                    : undefined
              }
              onClick={() => void handleApplyBulkDiscount()}
            >
              {saving || preflighting ? <Loader2 className="animate-spin" /> : <Percent />}
              {preflighting ? "Checking..." : "Apply"}
            </Button>
            <Button type="button" variant="outline" size="icon" disabled={saving} onClick={resetFilters} aria-label="Reset filters">
              <FilterX />
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <Card className="overflow-hidden rounded-md">
          <CardHeader className="gap-3 border-b">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageSearch className="size-4" />
                  Parent Products
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Only parent products are shown. Child variants are excluded from discount assignment.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => void loadProducts({
                  page,
                  pageSize: PRODUCT_PAGE_SIZE,
                  search,
                  categoryId,
                  brandId,
                  supplierId: selectedSupplierId,
                })}
              >
                <RefreshCw />
                Refresh
              </Button>
            </div>
              <Input
                value={search}
                disabled={saving}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search product name, code, or barcode"
                aria-label="Search parent products"
              />
          </CardHeader>
          <CardContent className="p-0">
            {productError ? (
              <div className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm text-destructive">
                <span>{productError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={productsLoading}
                  onClick={() => {
                    setProductError(null);
                    void loadProducts({
                      page,
                      pageSize: PRODUCT_PAGE_SIZE,
                      search,
                      categoryId,
                      brandId,
                      supplierId: selectedSupplierId,
                    });
                  }}
                >
                  {productsLoading ? <Loader2 className="size-3 animate-spin" /> : null}
                  Retry
                </Button>
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      disabled={visibleProductIds.length === 0 || saving}
                      onCheckedChange={(checked) => toggleCurrentPage(checked === true)}
                      aria-label="Select all products on this page"
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      Loading parent products...
                    </TableCell>
                  </TableRow>
                ) : productPage.products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      {productPage.emptyStateMessage ?? "No parent products found."}
                    </TableCell>
                  </TableRow>
                ) : productPage.products.map((product) => (
                  <TableRow
                    key={product.productId}
                    data-state={selectedProductIds.includes(product.productId) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedProductIds.includes(product.productId)}
                        disabled={saving}
                        onCheckedChange={(checked) => toggleProduct(product.productId, checked === true)}
                        aria-label={`Select ${product.productName}`}
                      />
                    </TableCell>
                    <TableCell className="min-w-64">
                      <ProductIdentity product={product} />
                    </TableCell>
                    <TableCell>{product.categoryName || "Uncategorized"}</TableCell>
                    <TableCell>{product.brandName || "No brand"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{discountText(product.discount)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(product.costPerUnit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-col gap-3 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedProductIds.length} selected - {productPage.pagination.total} matching parent products
              </p>
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      aria-disabled={page <= 1 || saving}
                      aria-label={page <= 1 ? "No previous page" : "Previous page"}
                      className={cn((page <= 1 || saving) && "pointer-events-none opacity-50")}
                      onClick={(event) => {
                        event.preventDefault();
                        if (!saving) setPage((current) => Math.max(1, current - 1));
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-3 text-sm tabular-nums text-muted-foreground">
                      {productPage.pagination.page} / {productPage.pagination.totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      aria-disabled={page >= productPage.pagination.totalPages || saving}
                      aria-label={page >= productPage.pagination.totalPages ? "No next page" : "Next page"}
                      className={cn((page >= productPage.pagination.totalPages || saving) && "pointer-events-none opacity-50")}
                      onClick={(event) => {
                        event.preventDefault();
                        if (!saving) setPage((current) => Math.min(productPage.pagination.totalPages, current + 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-md">
          <CardHeader className="gap-3 border-b">
            <CardTitle className="text-base">Current Supplier Rules</CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedSupplier ? selectedSupplier.supplierName : "Select a supplier to review existing item discounts."}
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={ruleSearchRef}
                value={ruleSearch}
                onChange={(event) => {
                  setRuleSearch(event.target.value);
                  setRulePage(1);
                }}
                placeholder="Search current rules"
                className="pl-9"
                disabled={!selectedSupplier}
                aria-label="Search current supplier discount rules"
              />
            </div>
            {rules.length > 0 ? (
              <div className="text-sm text-muted-foreground">
                Showing {ruleRangeStart}-{ruleRangeEnd} of {filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""}
                {filteredRules.length !== rules.length ? ` (${rules.length} total)` : ""}
              </div>
            ) : null}
            {selectedSupplier ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-foreground"
                  checked={includeChildren}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setRulePage(1);
                    setIncludeChildren(checked);
                    loadRules(selectedSupplier.id, checked);
                  }}
                />
                Show legacy child-product rules
              </label>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {!selectedSupplier ? (
              <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Select a supplier to show configured discounts.
              </div>
            ) : rulesLoading && rules.length === 0 ? (
              <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Loading supplier rules...
              </div>
            ) : rules.length === 0 ? (
              <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                No supplier discount rules configured.
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                No supplier discount rules match your search.
              </div>
            ) : (
              <>
                {rulesLoading ? (
                  <div className="flex items-center justify-center gap-2 border-b py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Refreshing...
                  </div>
                ) : null}
                <div className="divide-y">
                  {paginatedRules.map((rule) => (
                    <div key={rule.id} className="grid min-w-0 gap-3 p-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <RuleIdentity rule={rule} />
                          <div className="mt-2 flex min-w-0 flex-wrap gap-1">
                            <Badge variant="outline" className="max-w-full whitespace-normal text-left">
                              {rule.categoryName || "Uncategorized"}
                            </Badge>
                            <Badge variant="outline" className="max-w-full whitespace-normal text-left">
                              {rule.brandName || "No brand"}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          disabled={saving}
                          onClick={() => setPendingDeleteId(rule.id)}
                          aria-label={`Delete ${rule.productName} supplier discount`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="grid min-w-0 gap-1 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-[5rem_minmax(0,1fr)]">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="min-w-0 break-words font-medium">{discountText(rule.discount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredRules.length > RULE_PAGE_SIZE ? (
                  <div className="flex flex-col gap-3 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {ruleCurrentPage} of {ruleTotalPages}
                    </p>
                    <Pagination className="mx-0 w-auto justify-end">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            aria-disabled={ruleCurrentPage <= 1 || saving}
                            aria-label={ruleCurrentPage <= 1 ? "No previous rules page" : "Previous rules page"}
                            className={cn((ruleCurrentPage <= 1 || saving) && "pointer-events-none opacity-50")}
                            onClick={(event) => {
                              event.preventDefault();
                              if (!saving) setRulePage((current) => Math.max(1, current - 1));
                            }}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            aria-disabled={ruleCurrentPage >= ruleTotalPages || saving}
                            aria-label={ruleCurrentPage >= ruleTotalPages ? "No next rules page" : "Next rules page"}
                            className={cn((ruleCurrentPage >= ruleTotalPages || saving) && "pointer-events-none opacity-50")}
                            onClick={(event) => {
                              event.preventDefault();
                              if (!saving) setRulePage((current) => Math.min(ruleTotalPages, current + 1));
                            }}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier discount</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the discount for &ldquo;{pendingDeleteRule?.productName}&rdquo;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={() => {
                if (pendingDeleteId) void deleteRule(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingApplyId !== null} onOpenChange={(open) => { if (!open && !saving) setPendingApplyId(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply supplier discount</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingApplyNewCount > 0
                ? `${pendingApplyNewCount} new rule${pendingApplyNewCount !== 1 ? "s" : ""} will be created`
                : null}
              {pendingApplyNewCount > 0 && selectedProductIds.length - pendingApplyNewCount > 0 ? " and " : null}
              {selectedProductIds.length - pendingApplyNewCount > 0
                ? `${selectedProductIds.length - pendingApplyNewCount} existing rule${selectedProductIds.length - pendingApplyNewCount !== 1 ? "s" : ""} will be updated`
                : null}
              . Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={saving}
              onClick={async (event) => {
                event.preventDefault();
                const id = pendingApplyId;
                if (id == null) return;
                const saved = await applyBulkDiscount(id);
                if (saved) setDiscountTypeId(null);
                void loadProducts({
                  page,
                  pageSize: PRODUCT_PAGE_SIZE,
                  search,
                  categoryId,
                  brandId,
                  supplierId: selectedSupplierId,
                });
                setPendingApplyId(null);
              }}
            >
              {saving ? <>Saving<Loader2 className="ml-1 size-3 animate-spin" /></> : "Proceed"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
