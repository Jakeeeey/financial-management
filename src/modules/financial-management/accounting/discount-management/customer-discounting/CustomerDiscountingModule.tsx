"use client";

import { useMemo, useState } from "react";
import { FilterX, LayoutGrid, Settings2, Table2, Tags, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CustomerDiscountingConfigSheet } from "./components/CustomerDiscountingConfigSheet";
import { useCustomerDiscounting } from "./hooks/useCustomerDiscounting";
import type { CustomerDiscountingCustomer, DiscountOption } from "./types";

type Props = {
  userId: number | null;
};

type ViewMode = "table" | "card";

const pageSize = 10;

function discountText(discount: DiscountOption | null) {
  return discount ? `${discount.discountType} (${Number(discount.totalPercent || 0).toFixed(2)}%)` : "No global discount";
}

function defaultViewMode(): ViewMode {
  if (typeof window === "undefined") return "table";
  return window.matchMedia("(max-width: 767px)").matches ? "card" : "table";
}

export default function CustomerDiscountingModule({ userId }: Props) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [sheetOpen, setSheetOpen] = useState(false);
  const {
    moduleData,
    rules,
    selectedCustomer,
    selectCustomer,
    loading,
    rulesLoading,
    saving,
    error,
    updateGlobalDiscount,
    addSupplierCategoryRule,
    addProductRule,
    deleteSupplierCategoryRule,
    deleteProductRule,
  } = useCustomerDiscounting(userId);

  const customers = useMemo(() => {
    const rows = moduleData?.customers ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((customer) => {
      return (
        customer.customerName.toLowerCase().includes(query) ||
        customer.customerCode.toLowerCase().includes(query) ||
        customer.storeName.toLowerCase().includes(query)
      );
    });
  }, [moduleData?.customers, search]);

  const totalPages = Math.max(1, Math.ceil(customers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCustomers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return customers.slice(start, start + pageSize);
  }, [customers, safeCurrentPage]);
  const startItem = customers.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, customers.length);

  const updateSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const openCustomer = (customer: CustomerDiscountingCustomer) => {
    selectCustomer(customer);
    setSheetOpen(true);
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-md border border-destructive/20 bg-destructive/5 text-center">
          <FilterX className="mb-3 h-8 w-8 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Failed to Load Customer Discounting</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-primary/10">
            <Tags className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Customer Discounting</h1>
            <p className="text-sm text-muted-foreground">
              Configure global, supplier/category, and product-level customer pricing rules.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit">
          {(moduleData?.customers.length ?? 0).toLocaleString()} Customers
        </Badge>
      </div>

      <div className="flex flex-col gap-3 rounded-md border bg-card p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Search customer name, code, or store"
            className="pl-8"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {search ? (
            <Button variant="ghost" onClick={() => updateSearch("")}>
              <FilterX className="mr-2 h-4 w-4" />
              Clear
            </Button>
          ) : null}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value === "table" || value === "card") setViewMode(value);
            }}
            variant="outline"
            size="sm"
            aria-label="Select customer view"
          >
            <ToggleGroupItem value="table" aria-label="Table view">
              <Table2 className="h-4 w-4" />
              <span className="ml-2">Table</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="card" aria-label="Card view">
              <LayoutGrid className="h-4 w-4" />
              <span className="ml-2">Cards</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {viewMode === "table" ? (
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Code</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Global Discount</TableHead>
              <TableHead className="sticky right-0 z-10 w-[132px] bg-card text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-56" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell className="sticky right-0 z-10 bg-card shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]">
                    <Skeleton className="ml-auto h-8 w-28" />
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-sm text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-mono text-xs">{customer.customerCode}</TableCell>
                  <TableCell className="font-medium">{customer.customerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{customer.storeName || "No store"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{discountText(customer.globalDiscount)}</Badge>
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]">
                    <Button variant="outline" size="sm" onClick={() => openCustomer(customer)}>
                      <Settings2 className="mr-2 h-4 w-4" />
                      Configure
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      ) : null}

      {viewMode === "card" ? (
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-md border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-44" />
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
              <div className="mt-4 grid gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-40" />
              </div>
            </div>
          ))
        ) : paginatedCustomers.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-md border bg-card text-center text-sm text-muted-foreground">
            No customers found.
          </div>
        ) : (
          paginatedCustomers.map((customer) => (
            <div key={customer.id} className="rounded-md border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">Customer</div>
                  <div className="truncate font-medium">{customer.customerName}</div>
                </div>
                <Button variant="outline" size="icon" onClick={() => openCustomer(customer)} aria-label="Configure">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="grid grid-cols-[88px_1fr] gap-3">
                  <span className="text-muted-foreground">Code</span>
                  <span className="min-w-0 font-mono text-xs">{customer.customerCode}</span>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-3">
                  <span className="text-muted-foreground">Store</span>
                  <span className="min-w-0 truncate">{customer.storeName || "No store"}</span>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-3">
                  <span className="text-muted-foreground">Discount</span>
                  <Badge variant="outline" className="w-fit max-w-full truncate">
                    {discountText(customer.globalDiscount)}
                  </Badge>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      ) : null}

      {!loading && customers.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {customers.length} customers
          </p>
          <Pagination className="mx-0 w-auto justify-start sm:justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-disabled={safeCurrentPage === 1}
                  className={safeCurrentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault();
                    setCurrentPage((page) => Math.max(1, page - 1));
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-sm font-medium">
                  Page {safeCurrentPage} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={safeCurrentPage === totalPages}
                  className={safeCurrentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault();
                    setCurrentPage((page) => Math.min(totalPages, page + 1));
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}

      <CustomerDiscountingConfigSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        customer={selectedCustomer}
        discountTypes={moduleData?.discountTypes ?? []}
        suppliers={moduleData?.suppliers ?? []}
        categories={moduleData?.categories ?? []}
        supplierCategoryRules={rules.supplierCategoryRules}
        productRules={rules.productRules}
        loading={rulesLoading}
        saving={saving}
        onUpdateGlobalDiscount={updateGlobalDiscount}
        onAddSupplierCategoryRule={addSupplierCategoryRule}
        onAddProductRule={addProductRule}
        onDeleteSupplierCategoryRule={deleteSupplierCategoryRule}
        onDeleteProductRule={deleteProductRule}
      />
    </div>
  );
}
