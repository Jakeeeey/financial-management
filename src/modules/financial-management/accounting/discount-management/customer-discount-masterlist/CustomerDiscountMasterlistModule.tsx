"use client";

import { useEffect, useState, type WheelEvent } from "react";
import { FilterX, Loader2, Search, Building2, Tags, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerDiscountMasterlist } from "./hooks/useCustomerDiscountMasterlist";
import { customerDiscountingApi } from "../customer-discounting/providers/customerDiscountingApi";
import type { CustomerDiscountingSupplier } from "../customer-discounting/types";
import type { DiscountOption, MasterlistCustomerDiscount } from "./types";
import { generateCustomerDiscountMasterlistPdf } from "./utils/pdfGenerator";

function scrollDropdownWithWheel(event: WheelEvent<HTMLDivElement>) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.scrollTop += event.deltaY;
}

function discountText(discount: DiscountOption | null) {
  return discount ? `${discount.discountType} (${Number(discount.totalPercent || 0).toFixed(2)}%)` : "No discount";
}

function SupplierQuickOpen({
  inputId,
  onSelect,
  selectedSupplier,
}: {
  inputId?: string;
  onSelect: (supplier: CustomerDiscountingSupplier | null) => void;
  selectedSupplier: CustomerDiscountingSupplier | null;
}) {
  const [query, setQuery] = useState(selectedSupplier ? `${selectedSupplier.supplierName} (${selectedSupplier.supplierShortcut})` : "");
  const [options, setOptions] = useState<CustomerDiscountingSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(selectedSupplier?.id ?? null);

  useEffect(() => {
    if (selectedSupplier) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(`${selectedSupplier.supplierName} (${selectedSupplier.supplierShortcut})`);
      setSelectedId(selectedSupplier.id);
    }
  }, [selectedSupplier]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (selectedId || trimmedQuery.length < 2) {
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      customerDiscountingApi.searchSuppliers(trimmedQuery)
        .then((rows) => {
          if (!cancelled) {
            setOptions(rows);
            setOpen(true);
          }
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, selectedId]);

  const selectSupplier = (supplier: CustomerDiscountingSupplier) => {
    setQuery(`${supplier.supplierName} (${supplier.supplierShortcut})`);
    setSelectedId(supplier.id);
    setOptions([]);
    setOpen(false);
    onSelect(supplier);
  };

  const showDropdown = open && !selectedId && (loading || options.length > 0 || query.trim().length >= 2);

  return (
    <div className="relative w-full">
      <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        id={inputId}
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          if (selectedId) {
             setSelectedId(null);
             onSelect(null);
          }
          setQuery(nextQuery);
          setOpen(nextQuery.trim().length >= 2);
          if (nextQuery.trim().length < 2) {
            setOptions([]);
            setLoading(false);
          }
        }}
        onFocus={() => {
          if (!selectedId && options.length > 0) setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        placeholder="Search and select supplier"
        className="pl-8 pr-8"
      />
      {loading ? <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
      {showDropdown ? (
        <div
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 shadow-md"
          onWheel={scrollDropdownWithWheel}
        >
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Searching...</div>
          ) : options.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No suppliers found.</div>
          ) : (
            options.map((supplier) => (
              <button
                key={supplier.id}
                type="button"
                className="flex w-full flex-col rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSupplier(supplier)}
              >
                <span className="font-medium">{supplier.supplierName}</span>
                <span className="text-xs text-muted-foreground">{supplier.supplierShortcut}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function CustomerDiscountMasterlistModule() {
  const [selectedSupplier, setSelectedSupplier] = useState<CustomerDiscountingSupplier | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const { data: customers, isLoading, isError } = useCustomerDiscountMasterlist(
    selectedSupplier?.id ?? null,
    appliedSearch
  );

  const applyFilters = () => {
    setAppliedSearch(searchInput.trim());
  };

  const clearFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedSupplier(null);
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-primary/10">
            <Tags className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Customer Discount Masterlist</h1>
            <p className="text-sm text-muted-foreground">
              View customer discount configurations per supplier.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="h-9">
            {customers.length.toLocaleString()} Customers found
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => {
              if (selectedSupplier) {
                generateCustomerDiscountMasterlistPdf(selectedSupplier, customers);
              }
            }}
            disabled={!selectedSupplier || customers.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card p-4">
        <form
          className="grid w-full gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="masterlist-supplier-search">Select Supplier (Required)</Label>
            <SupplierQuickOpen 
              inputId="masterlist-supplier-search" 
              onSelect={setSelectedSupplier}
              selectedSupplier={selectedSupplier}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="masterlist-customer-search">Search Customer</Label>
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="masterlist-customer-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Customer name or code"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="hidden md:block">Actions</Label>
            <div className="flex items-center gap-2">
              <Button type="submit" className="h-10 whitespace-nowrap">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              {selectedSupplier || appliedSearch ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 whitespace-nowrap"
                  onClick={clearFilters}
                >
                  <FilterX className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      {isError ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-md border border-destructive/20 bg-destructive/5 text-center">
          <FilterX className="mb-3 h-8 w-8 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Failed to Load Masterlist</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Please try again or contact support.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[8rem] whitespace-normal">Code</TableHead>
                <TableHead className="w-[30%] whitespace-normal">Customer Name</TableHead>
                <TableHead className="w-[30%] whitespace-normal">Category</TableHead>
                <TableHead className="w-[20%] whitespace-normal">Discount Config</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!selectedSupplier ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center text-sm text-muted-foreground">
                    Please select a supplier to view the masterlist.
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-20 max-w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-56 max-w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40 max-w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32 max-w-full" /></TableCell>
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center text-sm text-muted-foreground">
                    No customers found for this supplier.
                  </TableCell>
                </TableRow>
              ) : (
                (() => {
                  let currentCustomerCode = "";
                  const spans = customers.reduce((acc, curr) => {
                    acc[curr.customerCode] = (acc[curr.customerCode] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);

                  return customers.map((item: MasterlistCustomerDiscount) => {
                    const isFirstOfGroup = currentCustomerCode !== item.customerCode;
                    if (isFirstOfGroup) {
                      currentCustomerCode = item.customerCode;
                    }

                    const spanCount = spans[item.customerCode];

                    return (
                      <TableRow key={item.id}>
                        {isFirstOfGroup && (
                          <TableCell rowSpan={spanCount} className="whitespace-normal break-all font-mono text-xs border-r align-top">
                            {item.customerCode}
                          </TableCell>
                        )}
                        {isFirstOfGroup && (
                          <TableCell rowSpan={spanCount} className="whitespace-normal break-words font-medium border-r align-top">
                            {item.customerName}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-normal break-words text-sm text-muted-foreground">
                          {item.categoryName || "All Categories"}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <Badge variant="outline" className="max-w-full whitespace-normal text-left">
                            {discountText(item.discount)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
