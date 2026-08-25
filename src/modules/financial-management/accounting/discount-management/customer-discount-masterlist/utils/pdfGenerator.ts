import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RowInput } from "jspdf-autotable";
import type { MasterlistCustomerDiscount } from "../types";
import type { CustomerDiscountingSupplier } from "../../customer-discounting/types";

export function generateCustomerDiscountMasterlistPdf(
  supplier: CustomerDiscountingSupplier,
  customers: MasterlistCustomerDiscount[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  // Add Header
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text("Customer Discount Masterlist", 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Supplier: ${supplier.supplierName} (${supplier.supplierShortcut})`, 40, 55);
  doc.text(`Total Customers: ${customers.length}`, 40, 70);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 85);

  if (customers.length === 0) {
    doc.text("No customers found for this supplier.", 40, 120);
    doc.save(`Customer_Discount_Masterlist_${supplier.supplierShortcut}.pdf`);
    return;
  }

  // Format table data with rowSpan for grouped customers
  const spans = customers.reduce((acc, curr) => {
    acc[curr.customerCode] = (acc[curr.customerCode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let currentCustomerCode = "";
  const tableData: RowInput[] = [];

  customers.forEach((c) => {
    const isFirstOfGroup = currentCustomerCode !== c.customerCode;
    if (isFirstOfGroup) {
      currentCustomerCode = c.customerCode;
    }

    const spanCount = spans[c.customerCode];
    const category = c.categoryName || "All Categories";
    const discount = c.discount ? `${c.discount.discountType} (${Number(c.discount.totalPercent).toFixed(2)}%)` : "No discount";

    if (isFirstOfGroup) {
      tableData.push([
        { content: c.customerCode, rowSpan: spanCount, styles: { valign: 'top' } },
        { content: c.customerName, rowSpan: spanCount, styles: { valign: 'top' } },
        category,
        discount
      ]);
    } else {
      tableData.push([category, discount]);
    }
  });

  autoTable(doc, {
    startY: 100,
    head: [["Customer Code", "Customer Name", "Category", "Discount Config"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [65, 84, 241],
      textColor: 255,
      fontSize: 10,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { top: 40, right: 40, bottom: 40, left: 40 },
  });

  doc.save(`Customer_Discount_Masterlist_${supplier.supplierShortcut}.pdf`);
}
