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

export type ReportPeriodType = "monthly" | "quarterly" | "yearly";

export const PERIOD_TYPE_OPTIONS: { value: ReportPeriodType; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export const QUARTER_OPTIONS = [
  { value: "1", label: "1st Quarter", months: MONTH_NAMES.slice(0, 3) },
  { value: "2", label: "2nd Quarter", months: MONTH_NAMES.slice(3, 6) },
  { value: "3", label: "3rd Quarter", months: MONTH_NAMES.slice(6, 9) },
  { value: "4", label: "4th Quarter", months: MONTH_NAMES.slice(9, 12) },
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

const toTitleCase = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export function useBudgetReports() {
  const currentMonth = new Date().getMonth() + 1;
  const [filters, setFilters] = useState({
    periodType: "monthly" as ReportPeriodType,
    year: String(new Date().getFullYear()),
    month: String(currentMonth),
    quarter: String(Math.ceil(currentMonth / 3)),
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

  const getReportPeriod = useCallback(() => {
    if (filters.periodType === "yearly") {
      return {
        label: filters.year,
        filenameLabel: filters.year,
        query: { year: filters.year, division_id: filters.division_id || undefined },
      };
    }

    if (filters.periodType === "quarterly") {
      const quarter = QUARTER_OPTIONS.find((option) => option.value === filters.quarter) || QUARTER_OPTIONS[0];
      const label = `${quarter.label.toUpperCase()} ${filters.year}`;

      return {
        label,
        filenameLabel: `${quarter.label.replace(/\s+/g, "_")}_${filters.year}`,
        query: {
          year: filters.year,
          months: quarter.months,
          division_id: filters.division_id || undefined,
        },
      };
    }

    const monthName = MONTH_NAMES[Number(filters.month) - 1] || MONTH_NAMES[new Date().getMonth()];
    const label = `${monthName.toUpperCase()} ${filters.year}`;

    return {
      label,
      filenameLabel: `${monthName}_${filters.year}`,
      query: {
        year: filters.year,
        month: monthName,
        division_id: filters.division_id || undefined,
      },
    };
  }, [filters]);

  const fetchReportData = useCallback(async (reportId: string) => {
    const period = getReportPeriod();
    const data = reportId === "approval-audit"
      ? await budgetReportService.getBudgetApprovalAuditReport(period.query)
      : reportId === "revised-history"
      ? await budgetReportService.getRevisedBudgetHistory(period.query)
      : reportId === "utilization" || reportId === "summary" || reportId === "account-wise"
      ? await budgetReportService.getBudgetUtilizationReport(period.query)
      : await budgetReportService.getBudgetAllocationReport(period.query);

    return { data, period };
  }, [getReportPeriod]);

  /**
   * INTERNAL: Shared PDF Generation Logic
   */
  const generatePdfBlob = useCallback(async (reportId: string, title: string, templateName: string) => {
    const { data, period } = await fetchReportData(reportId);

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
      const useMinimalTableStyle = true;
      const showTotalBudgetMeta = reportId !== "approval-audit" && reportId !== "revised-history";
      const hasSubtotalRow = !["approval-audit", "revised-history"].includes(reportId);

      // Header
      pdf.setFontSize(14).setFont("helvetica", "bold").setTextColor(0, 0, 0);
      pdf.text(title.toUpperCase(), useMinimalTableStyle ? margins.left : pageWidth / 2, currentY, { align: useMinimalTableStyle ? 'left' : 'center', baseline: 'top' });
      currentY += useMinimalTableStyle ? 9 : 10;

      // Meta Info
      if (useMinimalTableStyle) {
        pdf.setFontSize(7.5).setFont("helvetica", "bold").setTextColor(150, 150, 150);
        pdf.text("PERIOD: ", margins.left, currentY, { baseline: 'top' });
        const periodLabelW = pdf.getTextWidth("PERIOD: ");
        pdf.setTextColor(80, 80, 80);
        pdf.text(period.label, margins.left + periodLabelW, currentY, { baseline: 'top' });
        if (showTotalBudgetMeta) {
          const totalX = margins.left + 38;
          pdf.setTextColor(150, 150, 150);
          pdf.text("TOTAL BUDGET: ", totalX, currentY, { baseline: 'top' });
          const labelW = pdf.getTextWidth("TOTAL BUDGET: ");
          pdf.setTextColor(38, 91, 119);
          pdf.text(formatCurrency(grandTotal), totalX + labelW, currentY, { baseline: 'top' });
        }
        currentY += 12;
      } else {
        pdf.setFontSize(10).setFont("helvetica", "normal").setTextColor(100, 100, 100);
        pdf.text(`PERIOD: ${period.label}`, margins.left, currentY, { baseline: 'top' });
        currentY += 5;

        if (showTotalBudgetMeta) {
          pdf.text("TOTAL BUDGET: ", margins.left, currentY, { baseline: 'top' });
          const labelW = pdf.getTextWidth("TOTAL BUDGET: ");
          pdf.setFont("helvetica", "bold").setTextColor(41, 128, 185);
          pdf.text(formatCurrency(grandTotal), margins.left + labelW, currentY, { baseline: 'top' });
          currentY += 8;
        } else {
          currentY += 3;
        }
      }

      const effectiveBottom = config.bodyEnd ? (pageHeight - config.bodyEnd) : margins.bottom;

      const divisionEntries = Object.entries(groupedData);

      for (let divisionIndex = 0; divisionIndex < divisionEntries.length; divisionIndex++) {
        const [division, rawItems] = divisionEntries[divisionIndex];
        let headCols: unknown[] = [];
        let tableBody: unknown[][] = [];
        let divSub = 0, divUtil = 0, divRem = 0;

        if (reportId === "approval-audit") {
          headCols = [
            'DIVISION',
            'DEPARTMENT',
            'CHART OF ACCOUNT',
            { content: 'AMOUNT', styles: { halign: 'right' } },
            'CREATED BY',
            'POSITION',
            'DATE',
            'STATUS'
          ];
          tableBody = rawItems.map(i => [
            (i.divisionName || "-").toUpperCase(),
            (i.department || "-").toUpperCase(),
            (i.accountTitle || "-").toUpperCase(),
            { content: formatCurrency(i.amount || 0), styles: { halign: 'right' } },
            (i.performedByUser || "-").toUpperCase(),
            (i.performedByRole || "-").toUpperCase(),
            i.revisionDate || "-",
            (i.auditStatus || "-").toUpperCase()
          ]);
        } else if (reportId === "revised-history") {
          headCols = ['REVISION DATE', 'CHART OF ACCOUNT', { content: 'ORIGINAL', styles: { halign: 'right' } }, { content: 'REVISED', styles: { halign: 'right' } }];
          tableBody = rawItems.map(i => {
            const orig = i.originalAmount || 0;
            const rev = i.revisedAmount || i.amount || 0;
            return [
              i.revisionDate || "-",
              i.accountTitle.toUpperCase(),
              { content: formatCurrency(orig), styles: { halign: 'right' } },
              { content: formatCurrency(rev), styles: { halign: 'right' } }
            ];
          });
        } else if (reportId !== "allocation") {
          const aggregated = aggregateBudgetData(reportId, rawItems);
          headCols = reportId === "summary" ? ['DEPARTMENT', { content: 'BUDGETED', styles: { halign: 'right' } }, { content: 'UTILIZED', styles: { halign: 'right' } }, { content: 'REMAINING', styles: { halign: 'right' } }]
            : reportId === "account-wise" ? ['GL CODE', 'CHART OF ACCOUNT', { content: 'BUDGETED', styles: { halign: 'right' } }, { content: 'UTILIZED', styles: { halign: 'right' } }, { content: 'REMAINING', styles: { halign: 'right' } }]
            : ['DEPARTMENT', 'CHART OF ACCOUNT', { content: 'BUDGETED', styles: { halign: 'right' } }, { content: 'UTILIZED', styles: { halign: 'right' } }, { content: 'REMAINING', styles: { halign: 'right' } }, { content: '(UTILIZED / BUDGETED) x 100\nPERCENTAGE (%)', styles: { halign: 'right', fontSize: 6, cellPadding: 2 } }];

          tableBody = aggregated.map(row => {
            divSub += row.budgeted; divUtil += row.utilized; divRem += row.remaining;
            if (reportId === "summary") return [row.label, { content: formatCurrency(row.budgeted), styles: { halign: 'right' } }, { content: formatCurrency(row.utilized), styles: { halign: 'right' } }, { content: formatCurrency(row.remaining), styles: { halign: 'right' } }];
            if (reportId === "account-wise") return [row.label, row.subLabel, { content: formatCurrency(row.budgeted), styles: { halign: 'right' } }, { content: formatCurrency(row.utilized), styles: { halign: 'right' } }, { content: formatCurrency(row.remaining), styles: { halign: 'right' } }];
            return [row.label, row.subLabel, { content: formatCurrency(row.budgeted), styles: { halign: 'right' } }, { content: formatCurrency(row.utilized), styles: { halign: 'right' } }, { content: formatCurrency(row.remaining), styles: { halign: 'right' } }, { content: formatPercentage(row.percentage), styles: { halign: 'right' } }];
          });

          const divPct = divSub > 0 ? (divUtil / divSub) * 100 : 0;
          const subtotalLabel = `${toTitleCase(division)} Subtotal`;
          const subRow = reportId === "summary" ? [{ content: subtotalLabel, styles: { fontStyle: 'bold' } }, { content: formatCurrency(divSub), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divUtil), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divRem), styles: { halign: 'right', fontStyle: 'bold' } }]
            : reportId === "account-wise" ? [{ content: subtotalLabel, colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatCurrency(divSub), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divUtil), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divRem), styles: { halign: 'right', fontStyle: 'bold' } }]
            : [{ content: subtotalLabel, colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatCurrency(divSub), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divUtil), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(divRem), styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatPercentage(divPct), styles: { halign: 'right', fontStyle: 'bold' } }];
          tableBody.push(subRow);
        } else {
          divSub = rawItems.reduce((s, i) => s + i.amount, 0);
          headCols = ['DEPARTMENT', 'CHART OF ACCOUNT', { content: 'BUDGETED', styles: { halign: 'right' } }];
          tableBody = rawItems.map(i => [i.department.toUpperCase(), i.accountTitle.toUpperCase(), { content: formatCurrency(i.amount), styles: { halign: 'right' } }]);
          tableBody.push([{ content: `${toTitleCase(division)} Subtotal`, colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatCurrency(divSub), styles: { halign: 'right', fontStyle: 'bold' } }]);
        }

        const templateBodyEndY = config.bodyEnd || (pageHeight - margins.bottom);
        const bodyEndY = useMinimalTableStyle
          ? Math.min(pageHeight - margins.bottom - 8, templateBodyEndY + 16)
          : templateBodyEndY;
        const bodyRowCount = Math.max(tableBody.length, 1);
        const baseBodyPaddingY = 3.7;
        const baseHeadPaddingY = 3.2;
        const compactBodyPaddingY = 2.9;
        const compactHeadPaddingY = 2.6;
        let bodyPaddingY = baseBodyPaddingY;
        let headPaddingY = baseHeadPaddingY;

        if (useMinimalTableStyle) {
          const minimalHeadingHeight = 7.5;
          const sectionBottomGap = 5;
          const estimateHeadHeight = (headPad: number) => 7.2 * 0.35 + headPad * 2;
          const estimateRowHeight = (bodyPad: number) => 7.8 * 0.35 + bodyPad * 2;
          const estimateSectionHeight = (bodyPad: number, headPad: number) => {
            const estimatedHeadHeight = estimateHeadHeight(headPad);
            const estimatedBodyHeight = bodyRowCount * estimateRowHeight(bodyPad);
            return minimalHeadingHeight + estimatedHeadHeight + estimatedBodyHeight + sectionBottomGap;
          };
          const estimateSafeSectionStart = (bodyPad: number, headPad: number) =>
            minimalHeadingHeight + estimateHeadHeight(headPad) + estimateRowHeight(bodyPad);
          const baseEstimate = estimateSectionHeight(baseBodyPaddingY, baseHeadPaddingY);
          const compactEstimate = estimateSectionHeight(compactBodyPaddingY, compactHeadPaddingY);
          const baseStartEstimate = estimateSafeSectionStart(baseBodyPaddingY, baseHeadPaddingY);
          const compactStartEstimate = estimateSafeSectionStart(compactBodyPaddingY, compactHeadPaddingY);
          const remainingHeight = bodyEndY - currentY;
          const isNearTopOfPage = currentY <= margins.top + 14;

          if (baseEstimate > remainingHeight && compactEstimate <= remainingHeight && baseEstimate - remainingHeight <= 18) {
            bodyPaddingY = compactBodyPaddingY;
            headPaddingY = compactHeadPaddingY;
          } else if (baseEstimate > remainingHeight && baseStartEstimate <= remainingHeight) {
            bodyPaddingY = baseBodyPaddingY;
            headPaddingY = baseHeadPaddingY;
          } else if (baseEstimate > remainingHeight && compactStartEstimate <= remainingHeight) {
            bodyPaddingY = compactBodyPaddingY;
            headPaddingY = compactHeadPaddingY;
          } else if (baseEstimate > remainingHeight && !isNearTopOfPage) {
            pdf.addPage();
            currentY = margins.top + 10;
            if (baseEstimate > bodyEndY - currentY && compactEstimate <= bodyEndY - currentY) {
              bodyPaddingY = compactBodyPaddingY;
              headPaddingY = compactHeadPaddingY;
            }
          }
        } else if (currentY + 30 > bodyEndY) {
          pdf.addPage();
          currentY = margins.top + 10;
        }

        if (useMinimalTableStyle) {
          pdf.setTextColor(38, 91, 119).setFontSize(9.5).setFont("helvetica", "bold");
          pdf.text(division.toUpperCase(), margins.left, currentY, { baseline: 'top' });
          currentY += 4.5;
          pdf.setDrawColor(82, 124, 150).setLineWidth(0.35);
          pdf.line(margins.left, currentY, pageWidth - margins.right, currentY);
          currentY += 3;
        } else {
          pdf.setFillColor(41, 128, 185).rect(margins.left, currentY, pageWidth - margins.left - margins.right, 7, 'F');
          pdf.setTextColor(255).setFontSize(9).setFont("helvetica", "bold").text(division.toUpperCase(), pageWidth / 2, currentY + 3.5, { align: 'center', baseline: 'middle' });
          currentY += 7;
        }

        autoTable(pdf, {
          startY: currentY,
          margin: { ...margins, bottom: useMinimalTableStyle ? pageHeight - bodyEndY : effectiveBottom },
          head: [headCols] as unknown as RowInput[],
          body: tableBody as unknown as RowInput[],
          theme: useMinimalTableStyle ? 'plain' : 'grid',
          styles: useMinimalTableStyle
            ? { fontSize: 7.8, cellPadding: { top: bodyPaddingY, right: 2.2, bottom: bodyPaddingY, left: 2.2 }, textColor: [74, 74, 74], lineWidth: 0, valign: 'middle' }
            : { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.1 },
          headStyles: useMinimalTableStyle
            ? { fillColor: [248, 248, 248], textColor: [125, 125, 125], fontStyle: 'bold', fontSize: 7.2, lineWidth: 0, cellPadding: { top: headPaddingY, right: 2.2, bottom: headPaddingY, left: 2.2 } }
            : { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold', fontSize: 8, lineWidth: 0.1, lineColor: [200, 200, 200] },
          bodyStyles: useMinimalTableStyle ? { fillColor: [255, 255, 255] } : undefined,
          didParseCell: (d) => {
            const isSubtotalRow = hasSubtotalRow && d.row.index === tableBody.length - 1 && d.section === 'body';
            if (isSubtotalRow) {
              d.cell.styles.fillColor = useMinimalTableStyle ? [255, 255, 255] : [245, 245, 245];
              d.cell.styles.fontStyle = 'bold';
              d.cell.styles.textColor = useMinimalTableStyle ? [45, 45, 45] : d.cell.styles.textColor;
            }
          },
          didDrawCell: useMinimalTableStyle
            ? (d) => {
                const isSubtotal = hasSubtotalRow && d.section === 'body' && d.row.index === tableBody.length - 1;
                if (d.section === 'head') {
                  pdf.setDrawColor(205, 205, 205);
                  pdf.setLineWidth(0.22);
                  pdf.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
                }
                if (d.section === 'body') {
                  pdf.setDrawColor(isSubtotal ? 145 : 235, isSubtotal ? 145 : 235, isSubtotal ? 145 : 235);
                  pdf.setLineWidth(isSubtotal ? 0.45 : 0.12);
                  pdf.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
                }
              }
            : undefined
        });
        currentY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + (useMinimalTableStyle ? 5 : 10);
      }

      const totalPages = pdf.getNumberOfPages();
      for (let j = 1; j <= totalPages; j++) {
        pdf.setPage(j).setFontSize(9).setTextColor(150).text(`Page ${j} of ${totalPages}`, pageWidth / 2, pageHeight - (margins.bottom / 2), { align: 'center', baseline: 'middle' });
      }
    });

    return { doc, filename: `${title.replace(/\s+/g, '_')}_${period.filenameLabel}.pdf` };
  }, [fetchReportData, companyData]);

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
        const period = getReportPeriod();
        toast.info(`No budget allocation records found for ${period.label}.`);
      } else {
        toast.error(msg);
      }
      setActiveReportId(null);
    } finally { setLoading(false); }
  }, [generatePdfBlob, getReportPeriod]);

  const downloadReport = useCallback(async (reportId: string, title: string, templateName: string) => {
    if (!templateName) return toast.error("Please select a layout template first");
    setLoading(true);
    try {
      const { doc, filename } = await generatePdfBlob(reportId, title, templateName);
      doc.save(filename); toast.success("Report downloaded successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("No budget data found")) {
        const period = getReportPeriod();
        toast.info(`No budget allocation records found for ${period.label}.`);
      } else {
        toast.error(msg);
      }
    } finally { setLoading(false); }
  }, [generatePdfBlob, getReportPeriod]);

  const exportToExcel = useCallback(async (reportId: string, title: string) => {
    setLoading(true);
    try {
      const { data, period } = await fetchReportData(reportId);
      if (!data || data.length === 0) throw new Error("No budget data found");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Budget Report');
      const groupedData = data.reduce((acc, item) => {
        const divName = item.divisionName || "Unassigned";
        if (!acc[divName]) acc[divName] = [];
        acc[divName].push(item);
        return acc;
      }, {} as Record<string, AllocationReportItem[]>);

      const headCols = reportId === "approval-audit" ? ['DIVISION', 'DEPARTMENT', 'CHART OF ACCOUNT', 'AMOUNT', 'CREATED BY', 'POSITION', 'DATE', 'STATUS']
        : reportId === "revised-history" ? ['REVISION DATE', 'CHART OF ACCOUNT', 'ORIGINAL', 'REVISED']
        : reportId === "summary" ? ['DEPARTMENT', 'BUDGETED', 'UTILIZED', 'REMAINING']
        : reportId === "account-wise" ? ['GL CODE', 'CHART OF ACCOUNT', 'BUDGETED', 'UTILIZED', 'REMAINING']
        : reportId === "utilization" ? ['DEPARTMENT', 'CHART OF ACCOUNT', 'BUDGETED', 'UTILIZED', 'REMAINING', 'PERCENTAGE (%)']
        : ['DEPARTMENT', 'CHART OF ACCOUNT', 'BUDGETED'];

      const totalCols = headCols.length;
      const borderStyle: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      // Header Branding
      const titleRow = worksheet.addRow([title.toUpperCase()]);
      titleRow.height = 30; worksheet.mergeCells(1, 1, 1, totalCols);
      titleRow.font = { bold: true, size: 16 }; titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.addRow([`PERIOD: ${period.label}`]).font = { bold: true };
      if (reportId !== "approval-audit" && reportId !== "revised-history") {
        worksheet.addRow([`TOTAL BUDGET: ${formatCurrency(data.reduce((s, i) => s + i.amount, 0))}`]).font = { bold: true };
      }
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
              (i.divisionName || "-").toUpperCase(),
              (i.department || "-").toUpperCase(),
              (i.accountTitle || "-").toUpperCase(),
              i.amount || 0,
              (i.performedByUser || "-").toUpperCase(),
              (i.performedByRole || "-").toUpperCase(),
              i.revisionDate || "-",
              (i.auditStatus || "-").toUpperCase()
            ]);
            r.getCell(4).numFmt = '#,##0.00';
            r.eachCell(c => { c.border = borderStyle; c.alignment = { horizontal: 'left' }; });
            r.getCell(4).alignment = { horizontal: 'right' };
          });
        } else if (reportId === "revised-history") {
          rawItems.forEach(i => {
            const orig = i.originalAmount || 0;
            const rev = i.revisedAmount || i.amount || 0;
            const r = worksheet.addRow([i.revisionDate || "-", i.accountTitle.toUpperCase(), orig, rev]);
            r.getCell(3).numFmt = '#,##0.00'; r.getCell(4).numFmt = '#,##0.00';
            r.eachCell(c => { c.border = borderStyle; });
          });
        } else if (reportId !== "allocation") {
          aggregateBudgetData(reportId, rawItems).forEach(row => {
            dSub += row.budgeted; dUtil += row.utilized; dRem += row.remaining;
            const r = worksheet.addRow([]);
            if (reportId === "summary") { r.getCell(1).value = row.label; r.getCell(2).value = row.budgeted; r.getCell(3).value = row.utilized; r.getCell(4).value = row.remaining; }
            else if (reportId === "account-wise") { r.getCell(1).value = row.label; r.getCell(2).value = row.subLabel; r.getCell(3).value = row.budgeted; r.getCell(4).value = row.utilized; r.getCell(5).value = row.remaining; }
            else { 
              r.getCell(1).value = row.label; 
              r.getCell(2).value = row.subLabel; 
              r.getCell(3).value = row.budgeted; 
              r.getCell(4).value = row.utilized; 
              r.getCell(5).value = row.remaining; 
              r.getCell(6).value = row.percentage / 100; 
            }
            r.eachCell((c, i) => { 
              c.border = borderStyle; 
              if (i > 1 && !(reportId === "account-wise" && i === 2) && !(reportId === "utilization" && i === 2)) {
                c.numFmt = (reportId === "utilization" && i === 6) ? '0.00%' : '#,##0.00';
              }
            });
          });
          const sr = worksheet.addRow([]);
          const off = reportId === "account-wise" ? 1 : 0;
          sr.getCell(1).value = `${division.toUpperCase()} SUBTOTAL`;
          const subtotalOffset = reportId === "utilization" ? 1 : off;
          sr.getCell(2 + subtotalOffset).value = dSub; sr.getCell(3 + subtotalOffset).value = dUtil; sr.getCell(4 + subtotalOffset).value = dRem;
          if (reportId === "utilization") {
            sr.getCell(6).value = dSub > 0 ? (dUtil / dSub) : 0;
          }
          if (off || reportId === "utilization") worksheet.mergeCells(sr.number, 1, sr.number, 2);
          sr.eachCell((c, i) => { 
            c.font = { bold: true }; 
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; 
            if (i > 1 && !((off || reportId === "utilization") && i === 2)) {
              c.numFmt = (reportId === "utilization" && i === 6) ? '0.00%' : '#,##0.00';
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
      saveAs(new Blob([buffer]), `${title.replace(/\s+/g, '_')}_${period.filenameLabel}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)); } finally { setLoading(false); }
  }, [fetchReportData]);

  const closePreview = () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setActiveReportId(null); setPdfUrl(null); };

  return { filters, updateFilter, divisions, templates, loading, pdfUrl, activeReportId, previewReport, downloadReport, exportToExcel, closePreview };
}
