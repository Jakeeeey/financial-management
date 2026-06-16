import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

import type { MatrixRow } from "../../product-pricing/types";
import {
    currentColumnHeader,
    flattenPrintMatrixRows,
    proposedColumnHeader,
    type FlatSupplierProductRow,
    type PriceTypeRef,
} from "./flattenPrintMatrix";

export const BATCH_EXCEL_TEMPLATE_VERSION = 1;
export const BATCH_EXCEL_COMBINED_TEMPLATE_VERSION = 2;

const META_TEMPLATE_VERSION = "Template Version";
const META_SUPPLIER_ID = "Supplier ID";
const META_SUPPLIER_NAME = "Supplier Name";
const META_GENERATED_AT = "Generated At";

const COL_PRODUCT_ID = "Product ID";
const COL_PRODUCT_CODE = "Product Code";
const COL_BARCODE = "Barcode";
const COL_PRODUCT_NAME = "Product Name";
const COL_GROUP_ID = "Group ID";
const COL_PARENT_ID = "Parent ID";
const COL_UNIT_ID = "Unit ID";
const COL_CURRENT_LIST_COST = "Current List Cost";
const COL_PROPOSED_LIST_COST = "Proposed List Cost";

const IDENTITY_HEADERS = [
    COL_PRODUCT_ID,
    COL_PRODUCT_CODE,
    COL_BARCODE,
    COL_PRODUCT_NAME,
    COL_GROUP_ID,
    COL_PARENT_ID,
    COL_UNIT_ID,
] as const;

export type SupplierBatchPriceChange = {
    product_id: number;
    price_type_id: number;
    proposed_price: number;
    product_name: string;
    product_code: string | null;
    current_price: number | null;
};

export type SupplierBatchCostChange = {
    product_id: number;
    proposed_cost: number;
    product_name: string;
    product_code: string | null;
    current_cost: number | null;
};

export type BatchExcelParseResult =
    | {
          ok: true;
          supplierId: number;
          supplierName: string;
          priceChanges: SupplierBatchPriceChange[];
          costChanges: SupplierBatchCostChange[];
      }
    | { ok: false; errors: string[] };

function sortPriceTypes(priceTypes: PriceTypeRef[]) {
    return [...priceTypes].sort((a, b) => {
        const aSort = Number(a.sort ?? Number.MAX_SAFE_INTEGER);
        const bSort = Number(b.sort ?? Number.MAX_SAFE_INTEGER);
        return aSort - bSort || String(a.price_type_name ?? "").localeCompare(String(b.price_type_name ?? ""));
    });
}

function sanitizeFilenamePart(value: string) {
    return value.replace(/[<>:"/\\|?*]+/g, "_").trim() || "supplier";
}

export async function exportSupplierBatchExcel(args: {
    supplierId: number;
    supplierName: string;
    matrixRows: MatrixRow[];
    priceTypes: PriceTypeRef[];
    filenamePrefix?: string;
    includeListCost?: boolean;
}) {
    const {
        supplierId,
        supplierName,
        matrixRows,
        priceTypes,
        filenamePrefix = "price-change-batch",
        includeListCost = false,
    } = args;
    const sortedPriceTypes = sortPriceTypes(priceTypes);
    const flatRows = flattenPrintMatrixRows(matrixRows, sortedPriceTypes);
    const generatedAt = new Date();
    const templateVersion = includeListCost
        ? BATCH_EXCEL_COMBINED_TEMPLATE_VERSION
        : BATCH_EXCEL_TEMPLATE_VERSION;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Price Change Batch");

    sheet.addRow([META_TEMPLATE_VERSION, templateVersion]);
    sheet.addRow([META_SUPPLIER_ID, supplierId]);
    sheet.addRow([META_SUPPLIER_NAME, supplierName]);
    sheet.addRow([META_GENERATED_AT, generatedAt.toISOString()]);
    sheet.addRow([]);

    const headers = [
        ...IDENTITY_HEADERS,
        ...(includeListCost ? [COL_CURRENT_LIST_COST, COL_PROPOSED_LIST_COST] : []),
        ...sortedPriceTypes.flatMap((priceType) => [
            currentColumnHeader(priceType),
            proposedColumnHeader(priceType),
        ]),
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };

    for (const row of flatRows) {
        const values: Array<string | number | null> = [
            row.product_id,
            row.product_code ?? "",
            row.barcode ?? "",
            row.product_name,
            row.group_id,
            row.parent_id ?? "",
            row.unit_id ?? "",
        ];

        if (includeListCost) {
            values.push(row.current_list_cost);
            values.push(null);
        }

        for (const priceType of sortedPriceTypes) {
            const current = row.currentByPriceTypeId.get(priceType.price_type_id) ?? null;
            values.push(current);
            values.push(null);
        }

        sheet.addRow(values);
    }

    if (includeListCost) {
        const currentListCol = headers.indexOf(COL_CURRENT_LIST_COST) + 1;
        const proposedListCol = headers.indexOf(COL_PROPOSED_LIST_COST) + 1;
        if (currentListCol > 0) sheet.getColumn(currentListCol).numFmt = "#,##0.00";
        if (proposedListCol > 0) sheet.getColumn(proposedListCol).numFmt = "#,##0.00";
    }

    for (const priceType of sortedPriceTypes) {
        const currentHeader = currentColumnHeader(priceType);
        const proposedHeader = proposedColumnHeader(priceType);
        const currentCol = headers.indexOf(currentHeader) + 1;
        const proposedCol = headers.indexOf(proposedHeader) + 1;
        if (currentCol > 0) sheet.getColumn(currentCol).numFmt = "#,##0.00";
        if (proposedCol > 0) sheet.getColumn(proposedCol).numFmt = "#,##0.00";
    }

    sheet.columns.forEach((column) => {
        column.width = 18;
    });
    sheet.getColumn(4).width = 36;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const stamp = generatedAt.toISOString().slice(0, 10);
    saveAs(blob, `${filenamePrefix}-${sanitizeFilenamePart(supplierName)}-${stamp}.xlsx`);
}

function readMetaValue(rows: unknown[][], label: string): string {
    for (const row of rows) {
        if (!Array.isArray(row)) continue;
        if (String(row[0] ?? "").trim() === label) {
            return String(row[1] ?? "").trim();
        }
    }
    return "";
}

function findHeaderRowIndex(rows: unknown[][]): number {
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;
        if (row.some((cell) => String(cell ?? "").trim() === COL_PRODUCT_ID)) {
            return i;
        }
    }
    return -1;
}

function parseProposedValue(raw: unknown): { value: number | null; error: string | null } {
    if (raw === null || raw === undefined || raw === "") {
        return { value: null, error: null };
    }

    const text = String(raw).trim();
    if (!text) return { value: null, error: null };

    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
        return { value: null, error: "Invalid number" };
    }
    if (parsed < 0) {
        return { value: null, error: "Must be 0 or higher" };
    }

    return { value: parsed, error: null };
}

function resolvePriceTypeFromProposedHeader(
    header: string,
    priceTypes: PriceTypeRef[],
): PriceTypeRef | null {
    const trimmed = header.trim();
    if (!trimmed.endsWith(" Proposed")) return null;
    const label = trimmed.slice(0, -" Proposed".length).trim();
    if (!label) return null;

    const sorted = [...priceTypes].sort(
        (a, b) =>
            String(b.price_type_name ?? "").length - String(a.price_type_name ?? "").length,
    );

    for (const priceType of sorted) {
        const name = String(priceType.price_type_name ?? "").trim();
        if (name && label === name) return priceType;
        if (label === `#${priceType.price_type_id}`) return priceType;
    }

    return null;
}

export async function parseSupplierBatchExcelImport(args: {
    file: File;
    expectedSupplierId: number;
    priceTypes: PriceTypeRef[];
    matrixRows: MatrixRow[];
}): Promise<BatchExcelParseResult> {
    const { file, expectedSupplierId, priceTypes, matrixRows } = args;
    const errors: string[] = [];

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        return { ok: false, errors: ["Workbook has no worksheets."] };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];

    const templateVersion = Number(readMetaValue(rows, META_TEMPLATE_VERSION));
    if (
        templateVersion !== BATCH_EXCEL_TEMPLATE_VERSION &&
        templateVersion !== BATCH_EXCEL_COMBINED_TEMPLATE_VERSION
    ) {
        errors.push(`Unsupported template version (${String(templateVersion || "missing")}).`);
    }

    const supplierId = Number(readMetaValue(rows, META_SUPPLIER_ID));
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
        errors.push("Workbook is missing a valid supplier ID.");
    } else if (supplierId !== expectedSupplierId) {
        errors.push("Workbook supplier does not match the selected supplier filter.");
    }

    const supplierName = readMetaValue(rows, META_SUPPLIER_NAME);

    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex < 0) {
        errors.push("Could not find the product header row in the workbook.");
        return { ok: false, errors };
    }

    const headerCells = (rows[headerRowIndex] ?? []).map((cell) => String(cell ?? "").trim());
    const headerIndex = new Map<string, number>();
    headerCells.forEach((header, index) => {
        if (header) headerIndex.set(header, index);
    });

    for (const required of IDENTITY_HEADERS) {
        if (!headerIndex.has(required)) {
            errors.push(`Missing required column: ${required}`);
        }
    }

    const proposedColumns: Array<{ priceType: PriceTypeRef; columnIndex: number }> = [];
    for (const [header, columnIndex] of headerIndex.entries()) {
        const priceType = resolvePriceTypeFromProposedHeader(header, priceTypes);
        if (priceType) {
            proposedColumns.push({ priceType, columnIndex });
        }
    }

    const hasListCostColumn = headerIndex.has(COL_PROPOSED_LIST_COST);

    if (proposedColumns.length === 0 && !hasListCostColumn) {
        errors.push("No proposed price or list cost columns were found in the workbook.");
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    const flatByProductId = new Map<number, FlatSupplierProductRow>();
    for (const flat of flattenPrintMatrixRows(matrixRows, priceTypes)) {
        flatByProductId.set(flat.product_id, flat);
    }

    const priceChanges: SupplierBatchPriceChange[] = [];
    const costChanges: SupplierBatchCostChange[] = [];
    let validProposedCount = 0;
    const proposedListCostColIndex = hasListCostColumn
        ? headerIndex.get(COL_PROPOSED_LIST_COST)
        : undefined;

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (!Array.isArray(row) || row.every((cell) => String(cell ?? "").trim() === "")) {
            continue;
        }

        const productId = Number(row[headerIndex.get(COL_PRODUCT_ID)!]);
        if (!Number.isFinite(productId) || productId <= 0) {
            errors.push(`Row ${rowIndex + 1}: invalid product ID.`);
            continue;
        }

        const flat = flatByProductId.get(productId);
        if (!flat) {
            errors.push(`Row ${rowIndex + 1}: product #${productId} is not linked to the selected supplier.`);
            continue;
        }

        if (proposedListCostColIndex !== undefined) {
            const parsedCost = parseProposedValue(row[proposedListCostColIndex]);
            if (parsedCost.error) {
                errors.push(`Row ${rowIndex + 1}, Proposed List Cost: ${parsedCost.error}`);
            } else if (parsedCost.value !== null) {
                validProposedCount += 1;
                costChanges.push({
                    product_id: productId,
                    proposed_cost: parsedCost.value,
                    product_name: flat.product_name,
                    product_code: flat.product_code,
                    current_cost: flat.current_list_cost,
                });
            }
        }

        for (const { priceType, columnIndex } of proposedColumns) {
            const parsed = parseProposedValue(row[columnIndex]);
            if (parsed.error) {
                errors.push(
                    `Row ${rowIndex + 1}, ${priceType.price_type_name ?? priceType.price_type_id}: ${parsed.error}`,
                );
                continue;
            }
            if (parsed.value === null) continue;

            validProposedCount += 1;
            const current = flat.currentByPriceTypeId.get(priceType.price_type_id) ?? null;
            priceChanges.push({
                product_id: productId,
                price_type_id: priceType.price_type_id,
                proposed_price: parsed.value,
                product_name: flat.product_name,
                product_code: flat.product_code,
                current_price: current,
            });
        }
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    if (validProposedCount === 0) {
        return { ok: false, errors: ["No valid proposed prices or list costs were found in the workbook."] };
    }

    return {
        ok: true,
        supplierId: Number.isFinite(supplierId) ? supplierId : expectedSupplierId,
        supplierName: supplierName || `Supplier #${expectedSupplierId}`,
        priceChanges,
        costChanges,
    };
}
