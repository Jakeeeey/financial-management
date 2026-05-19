// src/modules/financial-management/accounting/discount-management/customer-discounting/components/CustomerDiscountingConfigSheet.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode, WheelEvent } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { customerDiscountingApi } from "../providers/customerDiscountingApi";
import type {
  CustomerDiscountingCategory,
  CustomerDiscountingCustomer,
  CustomerDiscountingProduct,
  CustomerDiscountingSupplier,
  DiscountOption,
  ProductRule,
  SupplierCategoryRule,
} from "../types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerDiscountingCustomer | null;
  discountTypes: DiscountOption[];
  suppliers: CustomerDiscountingSupplier[];
  categories: CustomerDiscountingCategory[];
  supplierCategoryRules: SupplierCategoryRule[];
  productRules: ProductRule[];
  loading: boolean;
  saving: boolean;
  onUpdateGlobalDiscount: (discountTypeId: number | null) => Promise<void>;
  onAddSupplierCategoryRule: (payload: {
    supplierId: number;
    categoryId: number;
    discountTypeId: number;
  }) => Promise<boolean>;
  onAddProductRule: (payload: {
    productId: number;
    discountTypeId: number | null;
    unitPrice: number | null;
  }) => Promise<boolean>;
  onDeleteSupplierCategoryRule: (id: number) => Promise<void>;
  onDeleteProductRule: (id: number) => Promise<void>;
};

type SelectOption = {
  value: string;
  label: string;
};

const noneValue = "none";

/**
 * Formats discount percentages consistently across tabs and rule tables.
 */
function percentLabel(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

/**
 * Builds a compact user-facing label for discount relations.
 */
function discountText(discount: DiscountOption | null) {
  return discount ? `${discount.discountType} (${percentLabel(discount.totalPercent)})` : "No discount";
}

/**
 * Chooses the best available unit-of-measurement label for product rows.
 */
function unitText(product: { unitName?: string; unitShortcut?: string }) {
  return product.unitShortcut || product.unitName || "No UOM";
}

/**
 * Combines the product name and UOM so selected products stay identifiable.
 */
function productPickerLabel(product: CustomerDiscountingProduct) {
  return `${product.productName} (${unitText(product)})`;
}

/**
 * Parses optional unit price overrides from the product rule form.
 */
function parseMoney(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Keeps nested dropdowns scrollable inside the sheet.
 */
function scrollDropdownWithWheel(event: WheelEvent<HTMLDivElement>) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.scrollTop += event.deltaY;
}

/**
 * Sheet UI for managing global, supplier/category, and product customer discounts.
 */
export function CustomerDiscountingConfigSheet({
  open,
  onOpenChange,
  customer,
  discountTypes,
  suppliers,
  categories,
  supplierCategoryRules,
  productRules,
  loading,
  saving,
  onUpdateGlobalDiscount,
  onAddSupplierCategoryRule,
  onAddProductRule,
  onDeleteSupplierCategoryRule,
  onDeleteProductRule,
}: Props) {
  const [globalOverride, setGlobalOverride] = useState<{ customerCode: string; value: string } | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierDiscountId, setSupplierDiscountId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productOptions, setProductOptions] = useState<CustomerDiscountingProduct[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CustomerDiscountingProduct | null>(null);
  const [productDiscountId, setProductDiscountId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  const discountOptions = useMemo(
    () => [
      { value: noneValue, label: "No Discount" },
      ...discountTypes.map((item) => ({
        value: String(item.id),
        label: `${item.discountType} (${percentLabel(item.totalPercent)})`,
      })),
    ],
    [discountTypes],
  );

  const globalDiscountId =
    customer && globalOverride?.customerCode === customer.customerCode
      ? globalOverride.value
      : customer?.globalDiscount
        ? String(customer.globalDiscount.id)
        : noneValue;

  // Product search stays local to the Product tab and waits until there is enough input.
  useEffect(() => {
    if (!open || productQuery.trim().length < 2 || selectedProduct) {
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      setProductLoading(true);
      customerDiscountingApi.searchProducts(productQuery)
        .then((rows) => {
          if (!cancelled) setProductOptions(rows);
        })
        .catch(() => {
          if (!cancelled) setProductOptions([]);
        })
        .finally(() => {
          if (!cancelled) setProductLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, productQuery, selectedProduct]);

  const resetSupplierForm = () => {
    setSupplierId("");
    setCategoryId("");
    setSupplierDiscountId("");
  };

  const resetProductForm = () => {
    setProductQuery("");
    setProductOptions([]);
    setSelectedProduct(null);
    setProductDiscountId("");
    setUnitPrice("");
  };

  const saveSupplierCategoryRule = async () => {
    const success = await onAddSupplierCategoryRule({
      supplierId: Number(supplierId),
      categoryId: Number(categoryId),
      discountTypeId: Number(supplierDiscountId),
    });
    if (success) resetSupplierForm();
  };

  const saveProductRule = async () => {
    if (!selectedProduct) return;
    const success = await onAddProductRule({
      productId: selectedProduct.productId,
      discountTypeId: productDiscountId ? Number(productDiscountId) : null,
      unitPrice: parseMoney(unitPrice),
    });
    if (success) resetProductForm();
  };

  const canSaveProduct = !!selectedProduct && (!!productDiscountId || unitPrice.trim().length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[960px]">
        <SheetHeader>
          <SheetTitle>Customer Discounting</SheetTitle>
          <SheetDescription>
            {customer ? `${customer.customerName} (${customer.customerCode})` : "Configure customer pricing rules"}
          </SheetDescription>
        </SheetHeader>

        {!customer ? null : (
          <Tabs defaultValue="global" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="global">Global</TabsTrigger>
              <TabsTrigger value="supplier-category">Supplier / Category</TabsTrigger>
              <TabsTrigger value="product">Product</TabsTrigger>
            </TabsList>

            <TabsContent value="global" className="space-y-4 pt-4">
              <div className="rounded-md border p-4">
                <div className="space-y-2">
                  <Label>Global Discount Type</Label>
                  <ConfigSearchableSelect
                    value={globalDiscountId}
                    onValueChange={(value) => {
                      if (customer) setGlobalOverride({ customerCode: customer.customerCode, value });
                    }}
                    options={discountOptions}
                    placeholder="Select global discount"
                  />
                </div>
                <Button
                  className="mt-4"
                  disabled={saving}
                  onClick={() => onUpdateGlobalDiscount(globalDiscountId === noneValue ? null : Number(globalDiscountId))}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Global Discount
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="supplier-category" className="space-y-4 pt-4">
              <div className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label>Trade Supplier</Label>
                  <ConfigSearchableSelect
                    value={supplierId}
                    onValueChange={setSupplierId}
                    options={suppliers.map((item) => ({ value: String(item.id), label: item.supplierName }))}
                    placeholder="Select supplier"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <ConfigSearchableSelect
                    value={categoryId}
                    onValueChange={setCategoryId}
                    options={categories.map((item) => ({ value: String(item.categoryId), label: item.categoryName }))}
                    placeholder="Select category"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <ConfigSearchableSelect
                    value={supplierDiscountId}
                    onValueChange={setSupplierDiscountId}
                    options={discountOptions.filter((item) => item.value !== noneValue)}
                    placeholder="Select discount"
                  />
                </div>
                <Button
                  disabled={saving || !supplierId || !categoryId || !supplierDiscountId}
                  onClick={saveSupplierCategoryRule}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add
                </Button>
              </div>

              <RuleTable loading={loading} emptyText="No supplier/category rules yet.">
                {supplierCategoryRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.supplierName || `Supplier #${rule.supplierId}`}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{discountText(rule.discount)}</Badge>
                    </TableCell>
                    <TableCell>{rule.categoryName || `Category #${rule.categoryId}`}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={saving}
                        onClick={() => onDeleteSupplierCategoryRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </RuleTable>
            </TabsContent>

            <TabsContent value="product" className="space-y-4 pt-4">
              <div className="rounded-md border p-4">
                <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_160px_auto] md:items-end">
                  <div className="relative space-y-2">
                    <Label>Product</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={selectedProduct ? productPickerLabel(selectedProduct) : productQuery}
                        onChange={(event) => {
                          if (event.target.value.trim().length < 2) setProductOptions([]);
                          setSelectedProduct(null);
                          setProductQuery(event.target.value);
                        }}
                        placeholder="Search product name, code, or barcode"
                        className="pl-8"
                      />
                    </div>
                    {(productLoading || productOptions.length > 0) && !selectedProduct ? (
                      <div
                        className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 shadow-md"
                        onWheel={scrollDropdownWithWheel}
                      >
                        {productLoading ? (
                          <div className="p-3 text-sm text-muted-foreground">Searching...</div>
                        ) : productOptions.map((product) => (
                          <button
                            key={product.productId}
                            type="button"
                            className="flex w-full flex-col rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              setSelectedProduct(product);
                              setProductQuery(productPickerLabel(product));
                              setProductOptions([]);
                            }}
                          >
                            <span className="font-medium">{product.productName}</span>
                            <span className="text-xs text-muted-foreground">
                              {product.productCode || "No code"} | {product.barcode || "No barcode"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              UOM: {unitText(product)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {selectedProduct ? (
                      <div className="text-xs text-muted-foreground">
                        Unit of measurement: {unitText(selectedProduct)}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <ConfigSearchableSelect
                      value={productDiscountId}
                      onValueChange={setProductDiscountId}
                      options={discountOptions.filter((item) => item.value !== noneValue)}
                      placeholder="Optional discount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input
                      value={unitPrice}
                      onChange={(event) => setUnitPrice(event.target.value)}
                      placeholder="Optional"
                      inputMode="decimal"
                    />
                  </div>
                  <Button disabled={saving || !canSaveProduct} onClick={saveProductRule}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Add
                  </Button>
                </div>
              </div>

              <RuleTable loading={loading} emptyText="No product rules yet.">
                {productRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="font-medium">{rule.productName || `Product #${rule.productId}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {rule.productCode || "No code"} | {rule.barcode || "No barcode"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        UOM: {unitText(rule)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{discountText(rule.discount)}</Badge>
                    </TableCell>
                    <TableCell>{rule.unitPrice === null ? "No override" : Number(rule.unitPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={saving}
                        onClick={() => onDeleteProductRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </RuleTable>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Local searchable select with explicit wheel handling for sheet dropdowns.
 */
function ConfigSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  disabled = false,
  className,
}: {
  options: SelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(() => {
    return options.find((option) => option.value === value)?.label;
  }, [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", !value && "text-muted-foreground", className)}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList
            className="max-h-64 overflow-y-auto overscroll-contain"
            onWheel={scrollDropdownWithWheel}
          >
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Shared rule table wrapper for supplier/category and product discount tabs.
 */
function RuleTable({
  loading,
  emptyText,
  children,
}: {
  loading: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rule</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-8 w-8" /></TableCell>
              </TableRow>
            ))
          ) : hasChildren ? (
            children
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
