import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

import type { MatrixRow } from "../../product-pricing/types";
import { flattenListCostMatrixRows, type FlatListCostProductRow } from "./flattenPrintMatrix";

export const LIST_COST_EXCEL_TEMPLATE_VERSION = 1;

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
    COL_CURRENT_LIST_COST,
    COL_PROPOSED_LIST_COST,
] as const;

export type ListCostImportLine = {
    product_id: number;
    product_code: string | null;
    barcode: string | null;
    product_name: string;
    current_cost: number | null;
    proposed_cost: number;
};

export type ListCostExcelParseResult =
    | {
          ok: true;
          supplierId: number;
          supplierName: string;
          lines: ListCostImportLine[];
      }
    | { ok: false; errors: string[] };

function sanitizeFilenamePart(value: string) {
    return value.replace(/[<>:"/\\|?*]+/g, "_").trim() || "supplier";
}

export async function exportSupplierListCostExcel(args: {
    supplierId: number;
    supplierName: string;
    matrixRows: MatrixRow[];
}) {
    const { supplierId, supplierName, matrixRows } = args;
    const flatRows = flattenListCostMatrixRows(matrixRows);
    const generatedAt = new Date();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("List Cost Batch");

    sheet.addRow([META_TEMPLATE_VERSION, LIST_COST_EXCEL_TEMPLATE_VERSION]);
    sheet.addRow([META_SUPPLIER_ID, supplierId]);
    sheet.addRow([META_SUPPLIER_NAME, supplierName]);
    sheet.addRow([META_GENERATED_AT, generatedAt.toISOString()]);
    sheet.addRow([]);

    const headerRow = sheet.addRow([...IDENTITY_HEADERS]);
    headerRow.font = { bold: true };

    for (const row of flatRows) {
        sheet.addRow([
            row.product_id,
            row.product_code ?? "",
            row.barcode ?? "",
            row.product_name,
            row.group_id,
            row.parent_id ?? "",
            row.unit_id ?? "",
            row.current_list_cost,
            null,
        ]);
    }

    const currentCol = IDENTITY_HEADERS.indexOf(COL_CURRENT_LIST_COST) + 1;
    const proposedCol = IDENTITY_HEADERS.indexOf(COL_PROPOSED_LIST_COST) + 1;
    if (currentCol > 0) sheet.getColumn(currentCol).numFmt = "#,##0.00";
    if (proposedCol > 0) sheet.getColumn(proposedCol).numFmt = "#,##0.00";

    sheet.columns.forEach((column) => {
        column.width = 18;
    });
    sheet.getColumn(4).width = 36;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const stamp = generatedAt.toISOString().slice(0, 10);
    saveAs(blob, `list-cost-batch-${sanitizeFilenamePart(supplierName)}-${stamp}.xlsx`);
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

export async function parseSupplierListCostExcelImport(args: {
    file: File;
    expectedSupplierId: number;
    matrixRows: MatrixRow[];
}): Promise<ListCostExcelParseResult> {
    const { file, expectedSupplierId, matrixRows } = args;
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
    if (templateVersion !== LIST_COST_EXCEL_TEMPLATE_VERSION) {
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

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    const flatByProductId = new Map<number, FlatListCostProductRow>();
    for (const flat of flattenListCostMatrixRows(matrixRows)) {
        flatByProductId.set(flat.product_id, flat);
    }

    const lines: ListCostImportLine[] = [];
    let validProposedCount = 0;
    const proposedColIndex = headerIndex.get(COL_PROPOSED_LIST_COST)!;

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

        const parsed = parseProposedValue(row[proposedColIndex]);
        if (parsed.error) {
            errors.push(`Row ${rowIndex + 1}, Proposed List Cost: ${parsed.error}`);
            continue;
        }
        if (parsed.value === null) continue;

        validProposedCount += 1;
        lines.push({
            product_id: productId,
            product_code: flat.product_code,
            barcode: flat.barcode,
            product_name: flat.product_name,
            current_cost: flat.current_list_cost,
            proposed_cost: parsed.value,
        });
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    if (validProposedCount === 0) {
        return { ok: false, errors: ["No valid proposed list costs were found in the workbook."] };
    }

    return {
        ok: true,
        supplierId: Number.isFinite(supplierId) ? supplierId : expectedSupplierId,
        supplierName: supplierName || `Supplier #${expectedSupplierId}`,
        lines,
    };
}
