"use client";

import * as React from "react";
import { toast } from "sonner";

import { fetchSupplierPrintMatrix } from "../../shared/supplier-batch/supplierPrintMatrix";
import { requireSingleSupplier } from "../../shared/supplier-batch/requireSingleSupplier";
import {
    exportSupplierListCostExcel,
    parseSupplierListCostExcelImport,
} from "../../shared/supplier-batch/supplierListCostExcel";
import type { SupplierOption } from "../providers/pcrApi";
import type { OpenSupplierPrintArgs } from "../../shared/print/useSupplierPrintEditor";
import type { ListCostImportPrefill } from "../types";

type Args = {
    supplierIds: number[] | undefined;
    suppliers: SupplierOption[];
    onOpenPrintEditor: (args: OpenSupplierPrintArgs) => void | Promise<void>;
};

export function useListCostSupplierExportImport({ supplierIds, suppliers, onOpenPrintEditor }: Args) {
    const [busy, setBusy] = React.useState(false);
    const [importPrefill, setImportPrefill] = React.useState<ListCostImportPrefill | null>(null);
    const [reviewOpen, setReviewOpen] = React.useState(false);
    const importFileInputRef = React.useRef<HTMLInputElement>(null);

    const loadSupplierMatrix = React.useCallback(async (supplierId: number) => {
        const matrixResult = await fetchSupplierPrintMatrix(supplierId);
        if (matrixResult.totalGroups === 0) {
            throw new Error("No linked products found for the selected supplier.");
        }
        return matrixResult;
    }, []);

    const handleExportPdf = React.useCallback(() => {
        const supplier = requireSingleSupplier(supplierIds, suppliers);
        if (!supplier) return;

        void onOpenPrintEditor({
            supplierId: supplier.id,
            supplierName: supplier.name,
            tierMode: "cost",
            exportModeLabel: "List Cost",
        });
    }, [onOpenPrintEditor, supplierIds, suppliers]);

    const handleExportExcel = React.useCallback(async () => {
        const supplier = requireSingleSupplier(supplierIds, suppliers);
        if (!supplier) return;

        setBusy(true);
        try {
            const data = await loadSupplierMatrix(supplier.id);
            await exportSupplierListCostExcel({
                supplierId: supplier.id,
                supplierName: supplier.name,
                matrixRows: data.rows,
            });
            toast.success("Excel template downloaded.");
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to export Excel.");
        } finally {
            setBusy(false);
        }
    }, [loadSupplierMatrix, supplierIds, suppliers]);

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
                const data = await loadSupplierMatrix(supplier.id);
                const parsed = await parseSupplierListCostExcelImport({
                    file,
                    expectedSupplierId: supplier.id,
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

                setImportPrefill({
                    supplierId: parsed.supplierId,
                    supplierName: parsed.supplierName,
                    remarks: "Imported list cost batch",
                    lines: parsed.lines,
                });
                setReviewOpen(true);
                toast.success("Imported list costs loaded into the review dialog.");
            } catch (error: unknown) {
                toast.error(error instanceof Error ? error.message : "Failed to import Excel.");
            } finally {
                setBusy(false);
            }
        },
        [loadSupplierMatrix, supplierIds, suppliers],
    );

    const clearImportPrefill = React.useCallback(() => {
        setImportPrefill(null);
    }, []);

    return {
        busy,
        importPrefill,
        reviewOpen,
        setReviewOpen,
        clearImportPrefill,
        importFileInputRef,
        handleExportPdf,
        handleExportExcel,
        handleImportExcelClick,
        handleImportExcelFile,
    };
}
