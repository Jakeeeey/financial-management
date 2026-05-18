import { useCallback, useState, useEffect } from "react";
import { budgetReportService } from "../services/budgetReportService";
import { reportLookupService } from "../services/reportLookupService";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { pdfTemplateService, PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";
import { CompanyData } from "@/components/pdf-layout-design/types";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import autoTable from "jspdf-autotable";
import type { RowInput } from "jspdf-autotable";
import { toast } from "sonner";
import { aggregateBudgetData, formatCurrency, formatPercentage } from "../utils/reportAggregation";
import { AllocationReportItem } from "../types";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const FALLBACK_COMPANY_DATA: CompanyData = {
  company_name: "TREASURY DEPARTMENT",
  company_address: "General Headquarters",
  company_brgy: "Central District",
  company_city: "Metropolitan Area",
  company_province: "National Capital Region",
  company_zipCode: "1000",
  company_contact: "+63 (2) 8888-9999",
  company_email: "treasury@antigravity.system",
  company_logo: ""
};

export function useBudgetReports() {
  const [filters, setFilters] = useState({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
    division_id: "",
  });

  const [divisions, setDivisions] = useState<{ id: string; name: string }[]>([]);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [divs, compRes, templateRes] = await Promise.all([
          reportLookupService.getDivisions(),
          fetch("/api/pdf/company").then(res => res.json()),
          pdfTemplateService.fetchTemplates()
        ]);
        setDivisions(divs.map((d) => ({ id: String(d.division_id), name: d.division_name })));
        setCompanyData(compRes.data?.[0] || (Array.isArray(compRes.data) ? null : compRes.data));
        setTemplates(templateRes);
      } catch (err) {
        console.error("Failed to initialize reports data", err);
      }
    };
    init();
  }, []);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  /**
   * INTERNAL: Shared PDF Generation Logic
   */
  const generatePdfBlob = useCallback(async (reportId: string, title: string, templateName: string) => {
    const monthName = MONTH_NAMES[Number(filters.month) - 1];
    const data = reportId === "approval-audit"
      ? await budgetReportService.getBudgetApprovalAuditReport({ year: filters.year, month: monthName, division_id: filters.division_id || undefined })
      : reportId === "revised-history"
      ? await budgetReportService.getRevisedBudgetHistory({ year: filters.year, month: monthName, division_id: filters.division_id || undefined })
      : await budgetReportService.getBudgetAllocationReport({ year: filters.year, month: monthName, division_id: filters.division_id || undefined });

    if (!data || data.length === 0) throw new Error("No budget data found for the selected period.");
    
    const grandTotal = data.reduce((sum, i) => sum + i.amount, 0);
    const groupedData = data.reduce((acc, item) => {
      const divName = item.divisionName || "Unassigned";
      if (!acc[divName]) acc[divName] = [];
      acc[divName].push(item);
      return acc;
    }, {} as Record<string, AllocationReportItem[]>);

    const effectiveCompanyData = companyData || FALLBACK_COMPANY_DATA;

    const doc = await PdfEngine.generateWithFrame(templateName, effectiveCompanyData, async (pdf, startY, config) => {
      const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };
      let currentY = startY;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Header
      pdf.setFontSize(14).setFont("helvetica", "bold").setTextColor(0, 0, 0);
      pdf.text(title.toUpperCase(), pageWidth / 2, currentY, { align: 'center', baseline: 'top' });
      currentY += 10;

      // Meta Info
      pdf.setFontSize(10).setFont("helvetica", "normal").setTextColor(100, 100, 100);
      pdf.text(`PERIOD: ${monthName.toUpperCase()} ${filters.year}`, margins.left, currentY, { baseline: 'top' });
      currentY += 5;
      pdf.text("TOTAL BUDGET: ", margins.left, currentY, { baseline: 'top' });
      const labelW = pdf.getTextWidth("TOTAL BUDGET: ");
      pdf.setFont("helvetica", "bold").setTextColor(41, 128, 185);
      pdf.text(formatCurrency(grandTotal), margins.left + labelW, currentY, { baseline: 'top' });
      currentY += 8;

      const effectiveBottom = config.bodyEnd ? (pageHeight - config.bodyEnd) : margins.bottom;

      for (const [division, rawItems] of Object.entries(groupedData)) {
        let headCols: unknown[] = [];
        let tableBody: unknown[][] = [];
        let divSub = 0, divUtil = 0, divRem = 0;

        if (reportId === "approval-audit") {
          headCols = ['ACTION', 'USER', 'ROLE', 'DATE', 'STATUS'];
          tableBody = rawItems.map(i => [
            (i.actionName || "—").toUpperCase(),
            (i.performedByUser || "—").toUpperCase(),
            (i.performedByRole || "—").toUpperCase(),
            i.revisionDate || "—",
            (i.auditStatus || "—").toUpperCase()
          ]);
        } else if (reportId === "revised-history") {
          let origSub = 0;
          headCols = ['REVISION DATE', 'CHART OF ACCOUNT', { content: 'ORIGINAL', styles: { halign: 'right' } }, { content: 'REVISED', styles: { halign: 'right' } }];
          tableBody = rawItems.map(i => {
            const orig = i.originalAmount || 0;
            const rev = i.revisedAmount || i.amount || 0;
            origSub += orig; divSub += rev;
            return [
              i.revisionDate || "—",
              i.accountTitle.toUpperCase(),
              { content: formatCurrency(orig), styles: { halign: 'right' } },
              { content: formatCurrency(rev), styles: { halign: 'right' } }
            ];
          });
          tableBody.push([
            { content: `${division.toUpperCase()} SUBTOTAL`, colSpan: 2, styles: { fontStyle: 'bold' } },
            { content: formatCurrency(origSub), styles: { halign: 'right', fontStyle: 'bold' } },
            { content: formatCurrency(divSub), styles: { halign: 'right', fontStyle: 'bold' } }
          ]);
        } else if (reportId !== "allocation") {
          const aggregated = aggregateBudgetData(reportId, rawItems);
          headCols = reportId === "summary" ? ['DEPARTMENT', { content: 'BUDGETED', styles: { halign: 'right' } }, { content: 'UTILIZED', styles: { halign: 'right' } }, { content: 'REMAINING', styles: { halign: 'right' } }]
            : reportId === "account-wise" ? ['GL CODE', 'CHART OF ACCOUNT', { content: 'BUDGETED', styles: { halign: 'right' } }, { content: 'UTILIZED', styles: { halign: 'right' } }, { content: 'REMAINING', styles: { halign: 'right' } }]
            : ['CHART OF ACCOUNT', { content: 'BUDGETED', styles: { halign: 'right' } }, { content: 'UTILIZED', styles: { halign: 'right' } }, { content: 'REMAINING', styles: { halign: 'right' } }, { content: 'PERCENTAGE (%)', styles: { halign: 'right' } }];

          tableBody = aggregated.map(row => {
            divSub += row.budgeted; divUtil += row.utilized; divRem += row.remaining;
            if (reportId === "summary") return [row.label, { content: formatCurrency(row.budgeted), styles: { halign: 'right' } }, { content: formatCurrency(row.utilized), styles: { halign: 'right' } }, { content: formatCurrency(row.remaining), styles: { halign: 'right' } }];
            if (reportId === "account-wise") return [row.label, row.subLabel, { content: formatCurrency(row.budgeted), styles: { halign: 'right' } }, { content: formatCurrency(row.utilized), styles: { halign: 'right' } }, { content: formatCurrency(row.remaining), styles: { halign: 'right' } }];
            return [row.label, { content: formatCurrency(row.budgeted), styles: { halign: 'right' } }, { content: formatCurrency(row.utilized), styles: { halign: 'right' } }, { content: formatCurrency(row.remaining), styles: { halign: 'right' } }, { content: formatPercentage(row.percentage), styles: { halign: 'right' } }];
          });

          const divPct = divSub > 0 ? (divUtil / divSub) * 100 : 0;
          const subRow = reportId === "summary" ? [{ content: `${division.toUpperCase()} SUBTOTAL`, styles: { fontStyle: 'bold' } }, { content: formatCurrency(divSub), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divUtil), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divRem), styles: { halign: 'right', fontStyle: 'bold' } }]
            : reportId === "account-wise" ? [{ content: `${division.toUpperCase()} SUBTOTAL`, colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatCurrency(divSub), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divUtil), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divRem), styles: { halign: 'right', fontStyle: 'bold' } }]
            : [{ content: `${division.toUpperCase()} SUBTOTAL`, styles: { fontStyle: 'bold' } }, { content: formatCurrency(divSub), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divUtil), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divRem), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatPercentage(divPct), styles: { halign: 'right', fontStyle: 'bold' } }];
          tableBody.push(subRow);
        } else {
          divSub = rawItems.reduce((s, i) => s + i.amount, 0);
          headCols = ['DEPARTMENT', 'CHART OF ACCOUNT', { content: 'BUDGETED', styles: { halign: 'right' } }];
          tableBody = rawItems.map(i => [i.department.toUpperCase(), i.accountTitle.toUpperCase(), { content: formatCurrency(i.amount), styles: { halign: 'right' } }]);
          tableBody.push([{ content: `${division.toUpperCase()} SUBTOTAL`, colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatCurrency(divSub), styles: { halign: 'right', fontStyle: 'bold' } }]);
        }

        if (currentY + 30 > (config.bodyEnd || pageHeight - margins.bottom)) { pdf.addPage(); currentY = margins.top + 10; }

        pdf.setFillColor(41, 128, 185).rect(margins.left, currentY, pageWidth - margins.left - margins.right, 7, 'F');
        pdf.setTextColor(255).setFontSize(9).setFont("helvetica", "bold").text(division.toUpperCase(), pageWidth / 2, currentY + 3.5, { align: 'center', baseline: 'middle' });
        currentY += 7;

        autoTable(pdf, {
          startY: currentY, margin: { ...margins, bottom: effectiveBottom }, head: [headCols] as unknown as RowInput[], body: tableBody as unknown as RowInput[], theme: 'grid',
          styles: { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.1 },
          headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold', fontSize: 8, lineWidth: 0.1, lineColor: [200, 200, 200] },
          didParseCell: (d) => { if (d.row.index === tableBody.length - 1 && d.section === 'body') { d.cell.styles.fillColor = [245, 245, 245]; d.cell.styles.fontStyle = 'bold'; } }
        });
        currentY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      const totalPages = pdf.getNumberOfPages();
      for (let j = 1; j <= totalPages; j++) {
        pdf.setPage(j).setFontSize(9).setTextColor(150).text(`Page ${j} of ${totalPages}`, pageWidth / 2, pageHeight - (margins.bottom / 2), { align: 'center', baseline: 'middle' });
      }
    });

    return { doc, filename: `${title.replace(/\s+/g, '_')}_${monthName}_${filters.year}.pdf` };
  }, [filters, companyData]);

  const previewReport = useCallback(async (reportId: string, title: string, templateName: string) => {
    if (!templateName) return toast.error("Please select a layout template first");
    setLoading(true);
    try {
      const { doc } = await generatePdfBlob(reportId, title, templateName);
      setPdfUrl(URL.createObjectURL(doc.output('blob')));
      setActiveReportId(reportId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("No budget data found")) {
        const monthName = MONTH_NAMES[Number(filters.month) - 1];
        toast.info(`No budget allocation records found for ${monthName.toUpperCase()} ${filters.year}.`);
      } else {
        toast.error(msg);
      }
      setActiveReportId(null);
    } finally { setLoading(false); }
  }, [generatePdfBlob, filters]);

  const downloadReport = useCallback(async (reportId: string, title: string, templateName: string) => {
    if (!templateName) return toast.error("Please select a layout template first");
    setLoading(true);
    try {
      const { doc, filename } = await generatePdfBlob(reportId, title, templateName);
      doc.save(filename); toast.success("Report downloaded successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("No budget data found")) {
        const monthName = MONTH_NAMES[Number(filters.month) - 1];
        toast.info(`No budget allocation records found for ${monthName.toUpperCase()} ${filters.year}.`);
      } else {
        toast.error(msg);
      }
    } finally { setLoading(false); }
  }, [generatePdfBlob, filters]);

  const exportToExcel = useCallback(async (reportId: string, title: string) => {
    setLoading(true);
    try {
      const monthName = MONTH_NAMES[Number(filters.month) - 1];
      const data = reportId === "approval-audit"
        ? await budgetReportService.getBudgetApprovalAuditReport({ year: filters.year, month: monthName, division_id: filters.division_id || undefined })
        : reportId === "revised-history"
        ? await budgetReportService.getRevisedBudgetHistory({ year: filters.year, month: monthName, division_id: filters.division_id || undefined })
        : await budgetReportService.getBudgetAllocationReport({ year: filters.year, month: monthName, division_id: filters.division_id || undefined });
      if (!data || data.length === 0) throw new Error("No budget data found");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Budget Report');
      const groupedData = data.reduce((acc, item) => {
        const divName = item.divisionName || "Unassigned";
        if (!acc[divName]) acc[divName] = [];
        acc[divName].push(item);
        return acc;
      }, {} as Record<string, AllocationReportItem[]>);

      const headCols = reportId === "approval-audit" ? ['ACTION', 'USER', 'ROLE', 'DATE', 'STATUS']
        : reportId === "revised-history" ? ['REVISION DATE', 'CHART OF ACCOUNT', 'ORIGINAL', 'REVISED']
        : reportId === "summary" ? ['DEPARTMENT', 'BUDGETED', 'UTILIZED', 'REMAINING']
        : reportId === "account-wise" ? ['GL CODE', 'CHART OF ACCOUNT', 'BUDGETED', 'UTILIZED', 'REMAINING']
        : reportId === "utilization" ? ['CHART OF ACCOUNT', 'BUDGETED', 'UTILIZED', 'REMAINING', 'PERCENTAGE (%)']
        : ['DEPARTMENT', 'CHART OF ACCOUNT', 'BUDGETED'];

      const totalCols = headCols.length;
      const borderStyle: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      // Header Branding
      const titleRow = worksheet.addRow([title.toUpperCase()]);
      titleRow.height = 30; worksheet.mergeCells(1, 1, 1, totalCols);
      titleRow.font = { bold: true, size: 16 }; titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.addRow([`PERIOD: ${monthName.toUpperCase()} ${filters.year}`]).font = { bold: true };
      worksheet.addRow([`TOTAL BUDGET: ${formatCurrency(data.reduce((s, i) => s + i.amount, 0))}`]).font = { bold: true };
      worksheet.addRow([]);

      Object.entries(groupedData).forEach(([division, rawItems]) => {
        let dSub = 0, dUtil = 0, dRem = 0;
        const divRow = worksheet.addRow([division.toUpperCase()]);
        divRow.height = 25; worksheet.mergeCells(divRow.number, 1, divRow.number, totalCols);
        divRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; divRow.alignment = { horizontal: 'center', vertical: 'middle' };
        divRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } }; });

        const hr = worksheet.addRow(headCols);
        hr.height = 20; hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        hr.eachCell((c, i) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } }; c.alignment = { horizontal: reportId === "approval-audit" || i === 1 || (reportId === "account-wise" && i === 2) || (reportId === "revised-history" && i === 2) ? 'left' : 'right' }; });

        if (reportId === "approval-audit") {
          rawItems.forEach(i => {
            const r = worksheet.addRow([
              (i.actionName || "—").toUpperCase(),
              (i.performedByUser || "—").toUpperCase(),
              (i.performedByRole || "—").toUpperCase(),
              i.revisionDate || "—",
              (i.auditStatus || "—").toUpperCase()
            ]);
            r.eachCell(c => { c.border = borderStyle; c.alignment = { horizontal: 'left' }; });
          });
        } else if (reportId === "revised-history") {
          let origSub = 0; let revSub = 0;
          rawItems.forEach(i => {
            const orig = i.originalAmount || 0;
            const rev = i.revisedAmount || i.amount || 0;
            origSub += orig; revSub += rev;
            const r = worksheet.addRow([i.revisionDate || "—", i.accountTitle.toUpperCase(), orig, rev]);
            r.getCell(3).numFmt = '#,##0.00'; r.getCell(4).numFmt = '#,##0.00';
            r.eachCell(c => { c.border = borderStyle; });
          });
          const sr = worksheet.addRow([`${division.toUpperCase()} SUBTOTAL`, '', origSub, revSub]);
          worksheet.mergeCells(sr.number, 1, sr.number, 2); sr.font = { bold: true };
          sr.getCell(3).numFmt = '#,##0.00'; sr.getCell(4).numFmt = '#,##0.00';
          sr.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; });
        } else if (reportId !== "allocation") {
          aggregateBudgetData(reportId, rawItems).forEach(row => {
            dSub += row.budgeted; dUtil += row.utilized; dRem += row.remaining;
            const r = worksheet.addRow([]);
            if (reportId === "summary") { r.getCell(1).value = row.label; r.getCell(2).value = row.budgeted; r.getCell(3).value = row.utilized; r.getCell(4).value = row.remaining; }
            else if (reportId === "account-wise") { r.getCell(1).value = row.label; r.getCell(2).value = row.subLabel; r.getCell(3).value = row.budgeted; r.getCell(4).value = row.utilized; r.getCell(5).value = row.remaining; }
            else { 
              r.getCell(1).value = row.label; 
              r.getCell(2).value = row.budgeted; 
              r.getCell(3).value = row.utilized; 
              r.getCell(4).value = row.remaining; 
              r.getCell(5).value = row.percentage / 100; 
            }
            r.eachCell((c, i) => { 
              c.border = borderStyle; 
              if (i > 1 && !(reportId === "account-wise" && i === 2)) {
                c.numFmt = (reportId === "utilization" && i === 5) ? '0.0%' : '#,##0.00';
              }
            });
          });
          const sr = worksheet.addRow([]);
          const off = reportId === "account-wise" ? 1 : 0;
          sr.getCell(1).value = `${division.toUpperCase()} SUBTOTAL`;
          sr.getCell(2 + off).value = dSub; sr.getCell(3 + off).value = dUtil; sr.getCell(4 + off).value = dRem;
          if (reportId === "utilization") {
            sr.getCell(5).value = dSub > 0 ? (dUtil / dSub) : 0;
          }
          if (off) worksheet.mergeCells(sr.number, 1, sr.number, 2);
          sr.eachCell((c, i) => { 
            c.font = { bold: true }; 
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; 
            if (i > 1 && !(off && i === 2)) {
              c.numFmt = (reportId === "utilization" && i === 5) ? '0.0%' : '#,##0.00';
            }
          });
        } else {
          rawItems.forEach(i => { const r = worksheet.addRow([i.department.toUpperCase(), i.accountTitle.toUpperCase(), i.amount]); r.getCell(3).numFmt = '#,##0.00'; r.eachCell(c => c.border = borderStyle); });
          const sr = worksheet.addRow([`${division.toUpperCase()} SUBTOTAL`, '', rawItems.reduce((s, i) => s + i.amount, 0)]);
          worksheet.mergeCells(sr.number, 1, sr.number, 2); sr.font = { bold: true }; sr.getCell(3).numFmt = '#,##0.00';
        }
        worksheet.addRow([]);
      });

      worksheet.getColumn(1).width = reportId === "approval-audit" ? 25 : 35;
      if (reportId === "account-wise" || reportId === "revised-history" || reportId === "approval-audit") worksheet.getColumn(2).width = 35;
      [2, 3, 4, 5].forEach(i => { if (!worksheet.getColumn(i).width) worksheet.getColumn(i).width = 20; });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `${title.replace(/\s+/g, '_')}_${monthName}_${filters.year}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)); } finally { setLoading(false); }
  }, [filters]);

  const closePreview = () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setActiveReportId(null); setPdfUrl(null); };

  return { filters, updateFilter, divisions, templates, loading, pdfUrl, activeReportId, previewReport, downloadReport, exportToExcel, closePreview };
}
