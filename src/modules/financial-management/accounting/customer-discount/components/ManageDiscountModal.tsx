"use client";

import { useState, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2, Search, FilterX, Printer } from "lucide-react";
import { Customer, CustomerDiscount, Supplier, Category, DiscountType } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { AddDiscountModal } from "./AddDiscountModal";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";

interface ManageDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  discounts: CustomerDiscount[];
  loading: boolean;
  suppliers: Supplier[];
  categories: Category[];
  discountTypes: DiscountType[];
  storeTypes: { id: number; store_type: string }[];
  classifications: { id: number; classification_name: string }[];
  onAdd: (data: Partial<CustomerDiscount>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  userName: string;
}

export function ManageDiscountModal({
  isOpen,
  onClose,
  customer,
  discounts,
  loading,
  suppliers,
  categories,
  discountTypes,
  storeTypes,
  classifications,
  onAdd,
  onDelete,
  userName,
}: ManageDiscountModalProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Filters for the table
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDiscountType, setFilterDiscountType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filteredDiscounts = useMemo(() => {
    return discounts.filter((d) => {
      const sId = typeof d.supplier_id === 'object' ? String(d.supplier_id?.id) : String(d.supplier_id);
      const cId = typeof d.category_id === 'object' ? String(d.category_id?.category_id) : String(d.category_id);
      const dtId = typeof d.discount_type === 'object' ? String(d.discount_type?.id) : String(d.discount_type);

      if (filterSupplier !== "all" && sId !== filterSupplier) return false;
      if (filterCategory !== "all" && cId !== filterCategory) return false;
      if (filterDiscountType !== "all" && dtId !== filterDiscountType) return false;
      return true;
    });
  }, [discounts, filterSupplier, filterCategory, filterDiscountType]);

  const paginatedDiscounts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDiscounts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDiscounts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredDiscounts.length / itemsPerPage);

  const handlePrint = async () => {
    if (!customer || !printRef.current) return;
    
    try {
      setIsPrinting(true);
      // Wait for a small timeout to ensure the hidden div is rendered if needed
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(printRef.current, { 
        quality: 1.0,
        pixelRatio: 2, // High quality
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`discount-${customer.customer_code}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  const clearFilters = () => {
    setFilterSupplier("all");
    setFilterCategory("all");
    setFilterDiscountType("all");
    setCurrentPage(1);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="max-w-[95vw] sm:max-w-[95vw] w-full max-h-[95vh] overflow-y-auto"
          showCloseButton={false}
        >
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle>Manage Discounts - {customer?.customer_name}</DialogTitle>
              <DialogDescription className="sr-only">
                List of discounts applied to this customer across various suppliers and categories.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={handlePrint} 
                className="gap-2 h-9"
                disabled={isPrinting}
              >
                <Printer className={cn("h-4 w-4", isPrinting && "animate-spin")} /> 
                {isPrinting ? "Generating..." : "Print"}
              </Button>
              <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 h-9">
                <Plus className="h-4 w-4" /> Add Discount
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Filters for the list */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="text-xs font-medium text-muted-foreground mr-2 flex items-center gap-1">
                <Search className="h-3 w-3" /> Filters:
              </div>
              
              <SearchableSelect
                value={filterSupplier}
                onValueChange={setFilterSupplier}
                placeholder="Supplier"
                options={[
                  { value: "all", label: "All Suppliers" },
                  ...suppliers.map(s => ({ value: String(s.id), label: s.supplier_name }))
                ]}
                className="w-[180px] h-9"
              />

              <SearchableSelect
                value={filterCategory}
                onValueChange={setFilterCategory}
                placeholder="Category"
                options={[
                  { value: "all", label: "All Categories" },
                  ...categories.map(c => ({ value: String(c.category_id), label: c.category_name }))
                ]}
                className="w-[180px] h-9"
              />

              <SearchableSelect
                value={filterDiscountType}
                onValueChange={setFilterDiscountType}
                placeholder="Discount Type"
                options={[
                  { value: "all", label: "All Types" },
                  ...discountTypes.map(dt => ({ value: String(dt.id), label: dt.discount_type }))
                ]}
                className="w-[180px] h-9"
              />

              {(filterSupplier !== "all" || filterCategory !== "all" || filterDiscountType !== "all") && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-[11px] gap-1">
                  <FilterX className="h-3 w-3" /> Clear
                </Button>
              )}
            </div>

            {/* Discounts Table */}
            <div className="rounded-md border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase">Supplier</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Category</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Discount Type</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Percent</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedDiscounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground bg-muted/10">
                        No discounts found for this customer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedDiscounts.map((d) => {
                      const s = typeof d.supplier_id === 'object' ? d.supplier_id : suppliers.find(x => x.id === d.supplier_id);
                      const c = typeof d.category_id === 'object' ? d.category_id : categories.find(x => x.category_id === d.category_id);
                      const dt = typeof d.discount_type === 'object' ? d.discount_type : discountTypes.find(x => x.id === d.discount_type);

                      return (
                        <TableRow key={d.id} className="group hover:bg-muted/30">
                          <TableCell className="text-xs font-medium">{s?.supplier_name || "—"}</TableCell>
                          <TableCell className="text-xs">{c?.category_name || "—"}</TableCell>
                          <TableCell className="text-xs">{dt?.discount_type || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {dt ? `${Number(dt.total_percent).toFixed(2)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => onDelete(d.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 0 && (
              <div className="flex flex-col md:flex-row items-center justify-between p-4 border-t bg-muted/20 gap-4 mt-4">
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span>Showing</span>
                  <Select
                    value={String(itemsPerPage)}
                    onValueChange={(val) => {
                      setItemsPerPage(Number(val));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={itemsPerPage} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[5, 10, 20, 50].map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>row(s) on this page • {filteredDiscounts.length} total</span>
                </div>
                
                <div className="flex items-center gap-6">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="font-semibold"
                  >
                    Prev
                  </Button>
                  
                  <div className="text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </div>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="font-semibold"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={onClose} className="h-9">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Discount Modal */}
      <AddDiscountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        customer={customer}
        suppliers={suppliers}
        categories={categories}
        discountTypes={discountTypes}
        onAdd={onAdd}
      />
      {/* Hidden Printable Container */}
      <div className="fixed -left-[9999px] top-0">
        <div 
          ref={printRef}
          className="w-[800px] p-10 bg-white text-black font-sans"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Customer Discount</h1>
            <div className="w-full h-1 bg-gray-800 rounded-full" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase font-bold">Customer Name</p>
              <p className="text-sm font-semibold">{customer?.customer_name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase font-bold">Customer Code</p>
              <p className="text-sm font-semibold">{customer?.customer_code}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase font-bold">Store Type</p>
              <p className="text-sm font-semibold">
                {typeof customer?.store_type === 'object' ? customer?.store_type?.store_type : storeTypes.find(s => s.id === customer?.store_type)?.store_type || "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase font-bold">Classification</p>
              <p className="text-sm font-semibold">
                {typeof customer?.classification === 'object' ? customer?.classification?.classification_name : classifications.find(c => c.id === customer?.classification)?.classification_name || "—"}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-8 border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Generated By</p>
                <p className="text-xs font-bold">{userName.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Generated At</p>
                <p className="text-xs font-bold">{new Date().toLocaleString().toUpperCase()}</p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-bold border-b-2 border-gray-100 pb-1 mb-4">DISCOUNTS</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800 text-white text-left text-xs">
                  <th className="p-3 rounded-tl-lg">Supplier</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Discount Type</th>
                  <th className="p-3 rounded-tr-lg">Percent</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiscounts.map((d, i) => {
                  const s = typeof d.supplier_id === 'object' ? d.supplier_id : suppliers.find(x => x.id === d.supplier_id);
                  const c = typeof d.category_id === 'object' ? d.category_id : categories.find(x => x.category_id === d.category_id);
                  const dt = typeof d.discount_type === 'object' ? d.discount_type : discountTypes.find(x => x.id === d.discount_type);
                  return (
                    <tr key={d.id} className={cn("text-xs border-b", i % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                      <td className="p-3 font-medium">{s?.supplier_name || "—"}</td>
                      <td className="p-3">{c?.category_name || "—"}</td>
                      <td className="p-3">{dt?.discount_type || "—"}</td>
                      <td className="p-3 font-bold">{dt ? `${Number(dt.total_percent).toFixed(2)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-12 text-center text-gray-400 text-[10px] italic">
            *** NOTHING FOLLOWS ***
          </div>
        </div>
      </div>
    </>
  );
}
