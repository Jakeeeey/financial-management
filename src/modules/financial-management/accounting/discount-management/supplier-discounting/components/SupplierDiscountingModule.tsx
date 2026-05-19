// src/modules/financial-management/accounting/discount-management/supplier-discounting/components/SupplierDiscountingModule.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterX, Loader2, PackageSearch, Percent, RefreshCw, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import type {
  SupplierDiscountModuleData,
  SupplierDiscountOption,
  SupplierDiscountProduct,
  SupplierDiscountRule,
} from "../types";

const PRODUCT_PAGE_SIZE = 10;

type SupplierDiscountingModuleProps = {
  initialModuleData: SupplierDiscountModuleData;
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
export default function SupplierDiscountingModule({ initialModuleData }: SupplierDiscountingModuleProps) {
  const {
    moduleData,
    selectedSupplier,
    rules,
    productPage,
    selectedProductIds,
    productsLoading,
    rulesLoading,
    saving,
    loadProducts,
    selectSupplier,
    toggleProduct,
    setSelectedProductIds,
    applyBulkDiscount,
    deleteRule,
  } = useSupplierDiscounting(initialModuleData);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [discountTypeId, setDiscountTypeId] = useState<number | null>(null);
  const [ruleSearch, setRuleSearch] = useState("");
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts({
        page,
        pageSize: PRODUCT_PAGE_SIZE,
        search,
        categoryId,
        brandId,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [brandId, categoryId, loadProducts, page, search]);

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
    const saved = await applyBulkDiscount(discountTypeId);
    if (saved) setDiscountTypeId(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-md border bg-background p-4 shadow-sm">
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
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Supplier</span>
            <NativeSelect
              className="w-full"
              value={selectedSupplier?.id ? String(selectedSupplier.id) : ""}
              onChange={(event) => {
                setRuleSearch("");
                selectSupplier(numberValue(event.target.value));
              }}
            >
              <NativeSelectOption value="">Select supplier</NativeSelectOption>
              {moduleData.suppliers.map((supplier) => (
                <NativeSelectOption key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Category</span>
            <NativeSelect
              className="w-full"
              value={categoryId ? String(categoryId) : ""}
              onChange={(event) => {
                setCategoryId(numberValue(event.target.value));
                setPage(1);
              }}
            >
              <NativeSelectOption value="">All categories</NativeSelectOption>
              {moduleData.categories.map((category) => (
                <NativeSelectOption key={category.categoryId} value={category.categoryId}>
                  {category.categoryName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Brand</span>
            <NativeSelect
              className="w-full"
              value={brandId ? String(brandId) : ""}
              onChange={(event) => {
                setBrandId(numberValue(event.target.value));
                setPage(1);
              }}
            >
              <NativeSelectOption value="">All brands</NativeSelectOption>
              {moduleData.brands.map((brand) => (
                <NativeSelectOption key={brand.brandId} value={brand.brandId}>
                  {brand.brandName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Discount</span>
            <NativeSelect
              className="w-full"
              value={discountTypeId ? String(discountTypeId) : ""}
              onChange={(event) => setDiscountTypeId(numberValue(event.target.value))}
            >
              <NativeSelectOption value="">Select discount</NativeSelectOption>
              {moduleData.discountTypes.map((discount) => (
                <NativeSelectOption key={discount.id} value={discount.id}>
                  {discountText(discount)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>

          <div className="flex items-end gap-2">
            <Button
              type="button"
              className="w-full xl:w-auto"
              disabled={saving || selectedProductIds.length === 0}
              onClick={() => void handleApplyBulkDiscount()}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Percent />}
              Apply
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={resetFilters} aria-label="Reset filters">
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
                onClick={() => void loadProducts({ page, pageSize: PRODUCT_PAGE_SIZE, search, categoryId, brandId })}
              >
                <RefreshCw />
                Refresh
              </Button>
            </div>
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search product name, code, or barcode"
            />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      disabled={visibleProductIds.length === 0}
                      onCheckedChange={(checked) => toggleCurrentPage(checked === true)}
                      aria-label="Select all products on this page"
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                      Loading parent products...
                    </TableCell>
                  </TableRow>
                ) : productPage.products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
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
                        onCheckedChange={(checked) => toggleProduct(product.productId, checked === true)}
                        aria-label={`Select ${product.productName}`}
                      />
                    </TableCell>
                    <TableCell className="min-w-64">
                      <ProductIdentity product={product} />
                    </TableCell>
                    <TableCell>{product.categoryName || "Uncategorized"}</TableCell>
                    <TableCell>{product.brandName || "No brand"}</TableCell>
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
                      aria-disabled={page <= 1}
                      className={cn(page <= 1 && "pointer-events-none opacity-50")}
                      onClick={(event) => {
                        event.preventDefault();
                        setPage((current) => Math.max(1, current - 1));
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
                      aria-disabled={page >= productPage.pagination.totalPages}
                      className={cn(page >= productPage.pagination.totalPages && "pointer-events-none opacity-50")}
                      onClick={(event) => {
                        event.preventDefault();
                        setPage((current) => Math.min(productPage.pagination.totalPages, current + 1));
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
                value={ruleSearch}
                onChange={(event) => setRuleSearch(event.target.value)}
                placeholder="Search current rules"
                className="pl-9"
                disabled={!selectedSupplier || rules.length === 0}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rulesLoading ? (
              <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Loading supplier rules...
              </div>
            ) : !selectedSupplier ? (
              <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Select a supplier to show configured discounts.
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
              <div className="divide-y">
                {filteredRules.map((rule) => (
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
                        onClick={() => void deleteRule(rule.id)}
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
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
