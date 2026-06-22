// src/modules/financial-management/printables-management/product-printables/components/ProductPrintablesView.tsx
"use client";

import * as React from "react";
import { useProductPrintables, defaultFilters } from "../hooks/useProductPrintables";
import { useLookups } from "../hooks/useLookups";
import type { FilterState, PriceType, Unit } from "../types";
import PrintablesFiltersBar from "./PrintablesFiltersBar";
import PrintablesMatrixTable from "./PrintablesMatrixTable";
import PrintPrepareDialog from "../../shared/print/PrintPrepareDialog";
import PrintLargeJobConfirmDialog from "../../shared/print/PrintLargeJobConfirmDialog";
import PrintPricingDialog from "../../shared/print/PrintPricingDialog";
import {
    assembleMatrixRowsWithPrices,
    fetchAllPrintableProducts,
} from "../utils/printablesBulkFetch";
import * as pricingApi from "../../product-pricing/providers/pricingApi";
import type { PrintFilterParams } from "../../product-pricing/providers/pricingApi";
import type { MatrixRow as PricingMatrixRow } from "../../product-pricing/types";
import { buildMatrixTierKeys } from "../../product-pricing/utils/pivot";
import {
    PRINT_CONFIRM_PRODUCT_THRESHOLD,
    PRINT_GROUP_CHUNK_SIZE,
} from "../../shared/print/printConstants";
import { exportProductPrintablesExcel } from "../utils/productPrintablesExcel";
import {
    ExcelExportOptionsDialog,
    type ExcelExportColumnMode,
} from "../../shared/supplier-batch/ExcelExportOptionsDialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

type PendingPrintJob = {
    printParams: PrintFilterParams;
    totalGroups: number;
    groupIds: number[];
    filtersText: string;
    supplierNames: string[];
};

function buildPrintFilterParams(filters: FilterState): PrintFilterParams {
    return {
        q: filters.q.trim() || undefined,
        category_ids: filters.category_ids.length ? filters.category_ids.join(",") : undefined,
        brand_ids: filters.brand_ids.length ? filters.brand_ids.join(",") : undefined,
        unit_ids: filters.unit_ids.length ? filters.unit_ids.join(",") : undefined,
        supplier_ids: filters.supplier_ids.length ? filters.supplier_ids.join(",") : undefined,
        supplier_scope: filters.supplier_scope,
        active_only: filters.active_only ? "1" : "0",
    };
}

export default function ProductPrintablesView({ userName }: { userName?: string }) {
    const [filters, setFilters] = React.useState<FilterState>(defaultFilters);
    const { categories, brands, units, suppliers, priceTypes, loading: lookupsLoading } = useLookups(filters);
    const { matrixRows, usedUnitIds, loading: productsLoading, resetFilters } = useProductPrintables(
        filters,
        setFilters,
        categories,
        brands,
        priceTypes,
    );
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [printPrepareOpen, setPrintPrepareOpen] = React.useState(false);
    const [printPrepareProgress, setPrintPrepareProgress] = React.useState({ done: 0, total: 0 });
    const [currentUser, setCurrentUser] = React.useState<string>(userName || "System User");
    const printAbortRef = React.useRef<AbortController | null>(null);
    const [excelOptionsOpen, setExcelOptionsOpen] = React.useState(false);
    const [largePrintConfirmOpen, setLargePrintConfirmOpen] = React.useState(false);
    const [pendingPrintJob, setPendingPrintJob] = React.useState<PendingPrintJob | null>(null);
    const [printOpen, setPrintOpen] = React.useState(false);
    const [printRows, setPrintRows] = React.useState<PricingMatrixRow[]>([]);
    const [printPriceTypes, setPrintPriceTypes] = React.useState<PriceType[]>([]);
    const [printUnits, setPrintUnits] = React.useState<Unit[]>([]);
    const [printTiers, setPrintTiers] = React.useState<string[]>([]);
    const [printUsedUnitIds, setPrintUsedUnitIds] = React.useState<Set<number>>(new Set());
    const [printFiltersText, setPrintFiltersText] = React.useState("");
    const [printGeneratedAt, setPrintGeneratedAt] = React.useState("");
    const [printSupplierNames, setPrintSupplierNames] = React.useState<string[]>([]);

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

        if (filters.unit_ids.length) {
            const names = filters.unit_ids.map(id => units.find(u => String(u.unit_id) === String(id))?.unit_shortcut).filter(Boolean);
            if (names.length) parts.push(`Units: ${names.join(", ")}`);
        } else {
            parts.push("Units: All Units");
        }

        parts.push(`Supplier Scope: ${filters.supplier_scope === "LINKED_ONLY" ? "Linked Only" : "All"}`);
        parts.push(`Products: ${filters.active_only ? "Active Only" : "Active and Inactive"}`);
        parts.push("Prices: All Configured Price Types");
        
        return parts.join("\n");
    }, [filters, categories, brands, suppliers, units]);

    const cancelPrintPrepare = React.useCallback(() => {
        printAbortRef.current?.abort();
        printAbortRef.current = null;
        setPrintPrepareOpen(false);
        setPrintPrepareProgress({ done: 0, total: 0 });
        setIsPrinting(false);
    }, []);

    const cancelLargePrintConfirm = React.useCallback(() => {
        setLargePrintConfirmOpen(false);
        setPendingPrintJob(null);
        setIsPrinting(false);
    }, []);

    React.useEffect(() => {
        return () => {
            printAbortRef.current?.abort();
        };
    }, []);

    const continuePrintPreparation = React.useCallback(async (job: PendingPrintJob) => {
        const controller = new AbortController();
        printAbortRef.current = controller;
        const { signal } = controller;

        setIsPrinting(true);
        setPrintPrepareProgress({ done: 0, total: job.totalGroups });
        setPrintPrepareOpen(true);

        try {
            const assembled: PricingMatrixRow[] = [];
            const usedUnitIds = new Set<number>();

            for (let offset = 0; offset < job.groupIds.length; offset += PRINT_GROUP_CHUNK_SIZE) {
                if (signal.aborted) return;

                const chunk = job.groupIds.slice(offset, offset + PRINT_GROUP_CHUNK_SIZE);
                const pageResult = await pricingApi.getPrintMatrixPage(
                    {
                        ...job.printParams,
                        group_ids: chunk.join(","),
                    },
                    { signal },
                );

                assembled.push(...(pageResult.data ?? []));
                for (const unitId of pageResult.usedUnitIds ?? []) {
                    usedUnitIds.add(Number(unitId));
                }

                setPrintPrepareProgress({
                    done: Math.min(offset + chunk.length, job.totalGroups),
                    total: job.totalGroups,
                });
            }

            const categoryNames = new Map(categories.map(category => [Number(category.category_id), category.category_name]));
            const brandNames = new Map(brands.map(brand => [Number(brand.brand_id), brand.brand_name]));
            const enriched = assembled.map(row => ({
                ...row,
                category_name: categoryNames.get(Number(row.display.product_category)) ?? null,
                brand_name: brandNames.get(Number(row.display.product_brand)) ?? null,
            }));
            enriched.sort((a, b) =>
                String(a.display.product_name ?? "").localeCompare(String(b.display.product_name ?? "")),
            );

            const configuredPriceTypes = priceTypes.filter(priceType => priceType.price_type_id !== -1);
            const now = new Date();

            setPrintRows(enriched);
            setPrintPriceTypes(configuredPriceTypes);
            setPrintUnits(units);
            setPrintTiers(buildMatrixTierKeys(configuredPriceTypes));
            setPrintUsedUnitIds(usedUnitIds);
            setPrintFiltersText(job.filtersText);
            setPrintGeneratedAt(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
            setPrintSupplierNames(job.supplierNames);
            setPrintOpen(true);
        } catch (error: unknown) {
            if (signal.aborted) return;
            toast.error(error instanceof Error ? error.message : "Failed to open print editor");
        } finally {
            if (printAbortRef.current === controller) {
                printAbortRef.current = null;
            }
            setPrintPrepareOpen(false);
            setPrintPrepareProgress({ done: 0, total: 0 });
            setIsPrinting(false);
        }
    }, [brands, categories, priceTypes, units]);

    const confirmLargePrint = React.useCallback(() => {
        const job = pendingPrintJob;
        if (!job) return;

        setLargePrintConfirmOpen(false);
        setPendingPrintJob(null);
        void continuePrintPreparation(job);
    }, [continuePrintPreparation, pendingPrintJob]);

    const handleExportPdf = React.useCallback(async () => {
        setIsPrinting(true);
        try {
            const printParams = buildPrintFilterParams(filters);
            const { meta, groupIds } = await pricingApi.getPrintMatrixMeta(printParams);

            if (meta.totalGroups === 0) {
                toast.warning("No printable products found for the current filters.");
                return;
            }

            const supplierNames = filters.supplier_ids
                .map(id => suppliers.find(supplier => String(supplier.id) === String(id))?.supplier_name)
                .filter((name): name is string => Boolean(name));
            const job: PendingPrintJob = {
                printParams,
                totalGroups: meta.totalGroups,
                groupIds,
                filtersText: filterSummary,
                supplierNames,
            };

            if (meta.totalGroups > PRINT_CONFIRM_PRODUCT_THRESHOLD) {
                setPendingPrintJob(job);
                setLargePrintConfirmOpen(true);
                return;
            }

            await continuePrintPreparation(job);
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to open print editor");
        } finally {
            setIsPrinting(false);
        }
    }, [continuePrintPreparation, filterSummary, filters, suppliers]);

    const handleExportExcelClick = () => {
        setExcelOptionsOpen(true);
    };

    const handleExportExcelWithOptions = async (mode: ExcelExportColumnMode) => {
        setExcelOptionsOpen(false);
        const result = await prepareExportData();
        if (!result) return;
        try {
            await exportProductPrintablesExcel({
                matrixRows: result.matrixRows,
                priceTypes,
                units,
                filterSummary,
                userName: currentUser,
                includeProposedColumns: mode === "with-proposed",
            });
            toast.success("Excel report downloaded.");
        } catch (error: unknown) {
            if (printAbortRef.current?.signal.aborted) return;
            toast.error(error instanceof Error ? error.message : "Failed to export Excel");
        }
    };

    const prepareExportData = async () => {
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
            const { matrixRows: assembled, usedUnitIds: unitIds } = await assembleMatrixRowsWithPrices(
                products,
                categories,
                brands,
                priceTypes,
                { signal: controller.signal },
            );

            if (controller.signal.aborted) return null;

            if (assembled.length === 0) {
                toast.info("No products matched the current filters.");
                return null;
            }

            toast.success(`Prepared ${assembled.length} groups for export.`);
            return { matrixRows: assembled, usedUnitIds: unitIds };
        } catch (error: unknown) {
            if (controller.signal.aborted) return null;
            toast.error(error instanceof Error ? error.message : "Failed to prepare export data");
            return null;
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
                        onClick={handleExportPdf}
                        disabled={productsLoading || lookupsLoading || isPrinting}
                        className="rounded-xl px-6 gap-2"
                    >
                        <FileDown className="w-4 h-4" />
                        {isPrinting ? "Preparing..." : "Export PDF"}
                    </Button>
                    <Button
                        onClick={handleExportExcelClick}
                        disabled={productsLoading || lookupsLoading || isPrinting}
                        variant="outline"
                        className="rounded-xl px-6 gap-2"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        {isPrinting ? "Preparing..." : "Export Excel"}
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

            <PrintLargeJobConfirmDialog
                open={largePrintConfirmOpen}
                totalGroups={pendingPrintJob?.totalGroups ?? 0}
                onContinue={confirmLargePrint}
                onCancel={cancelLargePrintConfirm}
            />

            <PrintPricingDialog
                open={printOpen}
                onOpenChange={setPrintOpen}
                rows={printRows}
                filtersText={printFiltersText}
                generatedAtText={printGeneratedAt}
                unitName={(id) => {
                    const unit = printUnits.find(entry => Number(entry.unit_id) === Number(id));
                    return unit?.unit_name ?? unit?.unit_shortcut ?? "";
                }}
                units={printUnits}
                priceTypes={printPriceTypes}
                tiers={printTiers}
                usedUnitIds={printUsedUnitIds}
                supplierNames={printSupplierNames}
                pdfTitle="Product Printables Masterlist"
                blocksPerPage={4}
                pdfSaveAsName={`Masterlist_Export_${new Date().toISOString().split("T")[0]}.pdf`}
                defaultFontSize={5}
            />

            <ExcelExportOptionsDialog
                open={excelOptionsOpen}
                onOpenChange={setExcelOptionsOpen}
                onConfirm={handleExportExcelWithOptions}
            />
        </div>
    );
}
