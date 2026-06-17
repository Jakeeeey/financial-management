// src/modules/financial-management/printables-management/product-printables/components/ProductPrintablesView.tsx
"use client";

import * as React from "react";
import { useProductPrintables, defaultFilters } from "../hooks/useProductPrintables";
import { useLookups } from "../hooks/useLookups";
import type { MatrixRow, FilterState } from "../types";
import PrintablesFiltersBar from "./PrintablesFiltersBar";
import PrintablesMatrixTable from "./PrintablesMatrixTable";
import PrintLabelsDialog from "./PrintLabelsDialog";
import PrintPrepareDialog from "../../shared/print/PrintPrepareDialog";
import {
    assembleMatrixRowsFromProducts,
    fetchAllPrintableProducts,
} from "../utils/printablesBulkFetch";
import { Button } from "@/components/ui/button";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function ProductPrintablesView({ userName }: { userName?: string }) {
    const [filters, setFilters] = React.useState<FilterState>(defaultFilters);
    const { categories, brands, units, suppliers, priceTypes, loading: lookupsLoading } = useLookups(filters);
    const { matrixRows, usedUnitIds, loading: productsLoading, resetFilters } = useProductPrintables(filters, setFilters, categories, brands);
    const [printOpen, setPrintOpen] = React.useState(false);
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [printPrepareOpen, setPrintPrepareOpen] = React.useState(false);
    const [printPrepareProgress, setPrintPrepareProgress] = React.useState({ done: 0, total: 0 });
    const [allMatrixRows, setAllMatrixRows] = React.useState<MatrixRow[]>([]);
    const [allUsedUnitIds, setAllUsedUnitIds] = React.useState<Set<number>>(new Set());
    const [currentUser, setCurrentUser] = React.useState<string>(userName || "System User");
    const printAbortRef = React.useRef<AbortController | null>(null);

    React.useEffect(() => {
        if (userName) {
            setCurrentUser(userName);
        }
    }, [userName]);

    const filterSummary = React.useMemo(() => {
        const parts: string[] = [];
        if (filters.q) parts.push(`Search: "${filters.q}"`);
        
        if (filters.supplier_ids.length) {
            const names = filters.supplier_ids.map(id => suppliers.find(s => String(s.id) === String(id))?.supplier_name).filter(Boolean);
            if (names.length) parts.push(`Suppliers: ${names.join(", ")}`);
        }

        if (filters.brand_ids.length) {
            const names = filters.brand_ids.map(id => brands.find(b => String(b.brand_id) === String(id))?.brand_name).filter(Boolean);
            if (names.length) parts.push(`Brands: ${names.join(", ")}`);
        } else {
            parts.push(`Brands: All Brands`);
        }

        if (filters.category_ids.length) {
            const names = filters.category_ids.map(id => categories.find(c => String(c.category_id) === String(id))?.category_name).filter(Boolean);
            if (names.length) parts.push(`Categories: ${names.join(", ")}`);
        } else {
            parts.push(`Categories: All Categories`);
        }
        
        return parts.join("\n");
    }, [filters, categories, brands, suppliers]);

    const cancelPrintPrepare = React.useCallback(() => {
        printAbortRef.current?.abort();
        printAbortRef.current = null;
        setPrintPrepareOpen(false);
        setPrintPrepareProgress({ done: 0, total: 0 });
        setIsPrinting(false);
    }, []);

    React.useEffect(() => {
        return () => {
            printAbortRef.current?.abort();
        };
    }, []);

    const handlePrintAll = async () => {
        const controller = new AbortController();
        printAbortRef.current = controller;
        setIsPrinting(true);
        setPrintPrepareProgress({ done: 0, total: 0 });
        setPrintPrepareOpen(true);
        try {
            const products = await fetchAllPrintableProducts(filters, {
                signal: controller.signal,
                onProgress: ({ done, total }) => setPrintPrepareProgress({ done, total }),
            });
            const { matrixRows: assembled, usedUnitIds: unitIds } = assembleMatrixRowsFromProducts(
                products,
                categories,
                brands,
            );

            setAllMatrixRows(assembled);
            setAllUsedUnitIds(unitIds);
            setPrintOpen(true);

            if (assembled.length > 0) {
                toast.success(`Prepared ${assembled.length} groups for printing.`);
            } else {
                toast.info("No products matched the current filters.");
            }
        } catch (error: unknown) {
            if (controller.signal.aborted) return;
            toast.error(error instanceof Error ? error.message : "Failed to prepare print data");
            console.error(error);
        } finally {
            if (printAbortRef.current === controller) {
                printAbortRef.current = null;
            }
            setIsPrinting(false);
            setPrintPrepareOpen(false);
            setPrintPrepareProgress({ done: 0, total: 0 });
        }
    };

    const handlePrevPage = () => {
        setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }));
    };

    const handleNextPage = () => {
        setFilters(prev => ({ ...prev, page: Math.min(prev.total_pages, prev.page + 1) }));
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                        Filter and generate spreadsheet-style matrix reports for your products.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handlePrintAll}
                        disabled={productsLoading || lookupsLoading || isPrinting}
                        className="rounded-xl px-6 gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        {isPrinting ? "Preparing..." : "Print Spreadsheet"}
                    </Button>
                </div>
            </div>

            <PrintablesFiltersBar
                filters={filters}
                setFilters={setFilters}
                resetFilters={resetFilters}
                categories={categories}
                brands={brands}
                units={units}
                suppliers={suppliers}
                priceTypes={priceTypes}
            />

            <PrintablesMatrixTable
                rows={matrixRows}
                loading={productsLoading}
                priceTypes={priceTypes}
                units={units}
                usedUnitIds={usedUnitIds}
                selectedPriceTypeIds={filters.price_type_ids}
            />

            {/* Pagination Controls */}
            {filters.total_pages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 bg-muted/20 rounded-2xl border border-border/50">
                    <div className="text-sm text-muted-foreground">
                        Page <span className="font-bold text-foreground">{filters.page}</span> of <span className="font-bold text-foreground">{filters.total_pages}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={filters.page === 1 || productsLoading}
                            onClick={handlePrevPage}
                            className="rounded-lg gap-1"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={filters.page === filters.total_pages || productsLoading}
                            onClick={handleNextPage}
                            className="rounded-lg gap-1"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            <PrintPrepareDialog
                open={printPrepareOpen}
                prepared={printPrepareProgress.done}
                total={printPrepareProgress.total}
                onCancel={cancelPrintPrepare}
            />

            <PrintLabelsDialog
                open={printOpen}
                onOpenChange={setPrintOpen}
                rows={allMatrixRows}
                priceTypes={priceTypes}
                units={units}
                usedUnitIds={allUsedUnitIds}
                supplier={filters.supplier_ids.length === 1 ? suppliers.find(s => String(s.id) === filters.supplier_ids[0]) : null}
                selectedPriceTypeIds={filters.price_type_ids}
                printedBy={currentUser}
                filterSummary={filterSummary}
            />
        </div>
    );
}
