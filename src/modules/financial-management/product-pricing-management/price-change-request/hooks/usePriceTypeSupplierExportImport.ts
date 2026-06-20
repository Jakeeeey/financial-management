"use client";

import * as React from "react";
import { toast } from "sonner";

import { fetchSupplierPrintMatrix } from "../../shared/supplier-batch/supplierPrintMatrix";
import { requireSingleSupplier } from "../../shared/supplier-batch/requireSingleSupplier";
import { productIdsFromMatrixRows } from "../../shared/supplier-batch/flattenPrintMatrix";
import type { SupplierOption } from "../providers/pcrApi";
import * as pcrApi from "../providers/pcrApi";
import type { BatchImportPrefill } from "../types";
import type { OpenSupplierPrintArgs } from "../../shared/print/useSupplierPrintEditor";
import { exportSupplierBatchExcel, parseSupplierBatchExcelImport } from "../utils/supplierBatchExcel";

type Args = {
    supplierIds: number[] | undefined;
    suppliers: SupplierOption[];
    includeListCost?: boolean;
    onOpenPrintEditor: (args: OpenSupplierPrintArgs) => void | Promise<void>;
};

export function usePriceTypeSupplierExportImport({
    supplierIds,
    suppliers,
    includeListCost = false,
    onOpenPrintEditor,
}: Args) {
    const [busy, setBusy] = React.useState(false);
    const [importPrefill, setImportPrefill] = React.useState<BatchImportPrefill | null>(null);
    const [creatingBatch, setCreatingBatch] = React.useState(false);
    const importFileInputRef = React.useRef<HTMLInputElement>(null);

    const loadSupplierExportData = React.useCallback(async (supplierId: number) => {
        const [matrixResult, priceTypesResult, lookupsResult] = await Promise.all([
            fetchSupplierPrintMatrix(supplierId),
            pcrApi.getPriceTypes(),
            pcrApi.getLookups(),
        ]);

        if (matrixResult.totalGroups === 0) {
            throw new Error("No linked products found for the selected supplier.");
        }

        return {
            ...matrixResult,
            priceTypes: priceTypesResult.data ?? [],
            units: lookupsResult.units ?? [],
        };
    }, []);

    const handleExportPdf = React.useCallback(() => {
        const supplier = requireSingleSupplier(supplierIds, suppliers);
        if (!supplier) return;

        void onOpenPrintEditor({
            supplierId: supplier.id,
            supplierName: supplier.name,
            tierMode: includeListCost ? "all" : "price",
            exportModeLabel: includeListCost
                ? "All (List Cost + Price Types)"
                : "Price Type",
        });
    }, [includeListCost, onOpenPrintEditor, supplierIds, suppliers]);

    const handleExportExcel = React.useCallback(async () => {
        const supplier = requireSingleSupplier(supplierIds, suppliers);
        if (!supplier) return;

        setBusy(true);
        try {
            const data = await loadSupplierExportData(supplier.id);
            const productIds = productIdsFromMatrixRows(data.rows);
            const [pendingPriceResult, pendingCostResult] = await Promise.all([
                pcrApi.getPendingPriceRequestsForProducts(productIds),
                includeListCost
                    ? pcrApi.getPendingCostRequestsForProducts(productIds)
                    : Promise.resolve({ data: [] }),
            ]);
            await exportSupplierBatchExcel({
                supplierId: supplier.id,
                supplierName: supplier.name,
                matrixRows: data.rows,
                priceTypes: data.priceTypes,
                units: data.units,
                includeListCost,
                pendingPriceRequests: pendingPriceResult.data,
                pendingCostRequests: pendingCostResult.data,
            });
            toast.success("Excel template downloaded.");
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to export Excel.");
        } finally {
            setBusy(false);
        }
    }, [includeListCost, loadSupplierExportData, supplierIds, suppliers]);

    const handleImportExcelClick = React.useCallback(() => {
        if (!requireSingleSupplier(supplierIds, suppliers)) return;
        importFileInputRef.current?.click();
    }, [supplierIds, suppliers]);

    const handleImportExcelFile = React.useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;

            const supplier = requireSingleSupplier(supplierIds, suppliers);
            if (!supplier) return;

            setBusy(true);
            try {
                const data = await loadSupplierExportData(supplier.id);
                const parsed = await parseSupplierBatchExcelImport({
                    file,
                    expectedSupplierId: supplier.id,
                    priceTypes: data.priceTypes,
                    matrixRows: data.rows,
                });

                if (!parsed.ok) {
                    const preview = parsed.errors.slice(0, 5).join("\n");
                    const suffix =
                        parsed.errors.length > 5
                            ? `\n…and ${parsed.errors.length - 5} more issue(s).`
                            : "";
                    toast.error(`Import validation failed.\n${preview}${suffix}`);
                    return;
                }

                setImportPrefill(parsed.prefill);
                setCreatingBatch(true);
                toast.success("Imported prices loaded into the new batch dialog.");
            } catch (error: unknown) {
                toast.error(error instanceof Error ? error.message : "Failed to import Excel.");
            } finally {
                setBusy(false);
            }
        },
        [loadSupplierExportData, supplierIds, suppliers],
    );

    const clearImportPrefill = React.useCallback(() => {
        setImportPrefill(null);
    }, []);

    return {
        busy,
        importPrefill,
        creatingBatch,
        setCreatingBatch,
        clearImportPrefill,
        importFileInputRef,
        handleExportPdf,
        handleExportExcel,
        handleImportExcelClick,
        handleImportExcelFile,
    };
}
