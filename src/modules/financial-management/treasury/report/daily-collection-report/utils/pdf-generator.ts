import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { CollectionItem, CollectionStats, DailyCollectionFilters, PaymentTypeData } from "../types";
import { DateRange } from "react-day-picker";

export const generateDailyCollectionPDF = (
    data: CollectionItem[],
    stats: CollectionStats,
    dateRange: DateRange | undefined,
    filters: DailyCollectionFilters,
    detailedPaymentMethodData: PaymentTypeData[]
) => {
    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
    });

    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let startY = 15;

    // --- 1. HEADER ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("MEN2 MARKETING", pageWidth / 2, startY, { align: "center" });

    startY += 8;
    doc.setFontSize(12);
    doc.text("DAILY COLLECTION REPORT", pageWidth / 2, startY, { align: "center" });

    startY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const dateStr = dateRange?.from 
        ? format(dateRange.from, "MMMM dd, yyyy") 
        : "All Dates";
    doc.text(`Period: ${dateStr}`, pageWidth / 2, startY, { align: "center" });

    startY += 12;

    // --- 2. SUMMARY SECTION ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Report Summary", marginX, startY);
    
    startY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const summaryData = [
        ["Total Collections:", `Php ${stats.totalCollections.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
        ["Total Transactions:", stats.totalTransactions.toString()],
        ["Average Collection:", `Php ${stats.avgCollection.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
        ["Unique Salesmen:", stats.uniqueSalesmen.toString()],
        ["Posted Items:", stats.totalPosted.toString()],
        ["Pending Items:", stats.totalPending.toString()],
    ];

    // Left column (2 items)
    doc.text(summaryData[0][0], marginX, startY);
    doc.text(summaryData[0][1], marginX + 35, startY);
    doc.text(summaryData[1][0], marginX, startY + 5);
    doc.text(summaryData[1][1], marginX + 35, startY + 5);
    doc.text(summaryData[2][0], marginX, startY + 10);
    doc.text(summaryData[2][1], marginX + 35, startY + 10);

    // Right column (3 items)
    doc.text(summaryData[3][0], pageWidth / 2 + 10, startY);
    doc.text(summaryData[3][1], pageWidth / 2 + 45, startY);
    doc.text(summaryData[4][0], pageWidth / 2 + 10, startY + 5);
    doc.text(summaryData[4][1], pageWidth / 2 + 45, startY + 5);
    doc.text(summaryData[5][0], pageWidth / 2 + 10, startY + 10);
    doc.text(summaryData[5][1], pageWidth / 2 + 45, startY + 10);

    startY += 20;

    // --- 3. PAYMENT METHOD BREAKDOWN ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Payment Method Breakdown", marginX, startY);
    
    startY += 6;
    autoTable(doc, {
        startY: startY,
        margin: { left: marginX, right: marginX },
        head: [['Payment Method', 'Total Amount', '% of Total']],
        body: detailedPaymentMethodData.map(item => {
            const percentage = stats.totalCollections > 0 ? (item.value / stats.totalCollections * 100).toFixed(1) : "0.0";
            return [
                item.name,
                { content: `Php ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { halign: 'right' } },
                { content: `${percentage}%`, styles: { halign: 'right' } }
            ];
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [70, 70, 70], textColor: 255 },
        theme: 'grid',
        columnStyles: {
            1: { cellWidth: 40 },
            2: { cellWidth: 25 }
        }
    });

    // @ts-expect-error - jspdf-autotable adds lastAutoTable to jsPDF instance
    startY = doc.lastAutoTable.finalY + 10;

    // --- 4. FILTERS APPLIED ---
    if (filters.salesman || filters.type || filters.isPosted || filters.paymentMethod) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        const activeFilters = [];
        if (filters.salesman) activeFilters.push(`Salesman: ${filters.salesman}`);
        if (filters.type) activeFilters.push(`Payment Type: ${filters.type}`);
        if (filters.paymentMethod) activeFilters.push(`Payment Method: ${filters.paymentMethod}`);
        if (filters.isPosted) activeFilters.push(`Status: ${filters.isPosted === "1" ? "Posted" : "Pending"}`);
        
        doc.text(`Filters Applied: ${activeFilters.join(" | ")}`, marginX, startY);
        startY += 5;
    }

    // --- 5. DATA TABLE ---
    autoTable(doc, {
        startY: startY,
        margin: { left: 10, right: 10 },
        theme: 'grid',
        styles: { 
            fontSize: 7, 
            cellPadding: 2,
            valign: 'middle',
            overflow: 'linebreak',
            lineColor: [200, 200, 200],
            lineWidth: 0.1 
        },
        headStyles: { 
            fillColor: [245, 245, 245], 
            textColor: [0, 0, 0], 
            fontStyle: 'bold',
            lineWidth: 0.1
        },
        footStyles: { 
            fillColor: [240, 240, 240], 
            textColor: 0, 
            fontStyle: 'bold', 
            lineColor: 0, 
            lineWidth: 0.1 
        },
        head: [['#', 'Doc No', 'Receipt No', 'Coll Date', 'Enc Date', 'Salesman', 'Coll By', 'Type', 'Method', 'Status', 'Remarks', 'Detail Amt', 'Total Amt']],
        body: data.map((item, index) => [
            (index + 1).toString(),
            item.docNo || "-",
            item.receiptNo || "-",
            item.collectionDate ? format(new Date(item.collectionDate), "MMM dd, yyyy") : "-",
            item.dateEncoded ? format(new Date(item.dateEncoded), "MMM dd, yy") : "-",
            item.salesman || "-",
            item.collectedBy || "-",
            item.type || "-",
            item.paymentMethodName || "-",
            item.isPosted === 1 ? "Posted" : "Pending",
            item.remarks || item.detailRemarks || "-",
            { 
                content: (item.detailAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }), 
                styles: { halign: 'right' } 
            },
            { 
                content: (item.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }), 
                styles: { halign: 'right' } 
            }
        ]),
        foot: [[
            { content: 'TOTAL COLLECTIONS', colSpan: 12, styles: { halign: 'right', fontStyle: 'bold' } },
            { 
                content: stats.totalCollections.toLocaleString('en-US', { minimumFractionDigits: 2 }), 
                styles: { halign: 'right', fontStyle: 'bold' } 
            }
        ]],
        showFoot: 'lastPage',
        showHead: 'firstPage',
        columnStyles: {
            0: { cellWidth: 10 }, // #
            1: { cellWidth: 17 }, // Doc No
            2: { cellWidth: 17 }, // Receipt No
            3: { cellWidth: 18 }, // Coll Date
            4: { cellWidth: 17 }, // Enc Date
            5: { cellWidth: 24 }, // Salesman
            6: { cellWidth: 24 }, // Coll By
            7: { cellWidth: 18 }, // Type
            8: { cellWidth: 18 }, // Method
            9: { cellWidth: 18 }, // Status
            10: { cellWidth: 'auto' }, // Remarks
            11: { cellWidth: 20, halign: 'right' }, // Detail Amt
            12: { cellWidth: 20, halign: 'right' }  // Total Amt
        },
        didDrawPage: (data) => {
            const pageCount = doc.getNumberOfPages();
            doc.setFontSize(8);
            doc.text(
                `Page ${data.pageNumber} of ${pageCount}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: "center" }
            );
        }
    });

    const dateSuffix = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "all-dates";
    doc.save(`daily-collection-${dateSuffix}.pdf`);
};
