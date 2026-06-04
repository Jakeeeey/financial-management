import { CollectionSummaryReportDto, CheckDetailDto, InvoiceClearedDto, VarianceDetailDto } from "../hooks/useCollectionReport";

export interface PouchSummary {
    docNo: string;
    date: string;
    isPosted: boolean;
    invoices: InvoiceClearedDto[];
    checks: CheckDetailDto[];
    variances: VarianceDetailDto[];
    totalSettled: number;
    totalChecks: number;
    netVariance: number;
}

export const processPouchData = (reportData: CollectionSummaryReportDto): PouchSummary[] => {
    const pouchMap: Record<string, PouchSummary> = {};

    const ensurePouch = (docNo: string, date: string, isPosted: boolean) => {
        if (!pouchMap[docNo]) {
            pouchMap[docNo] = {
                docNo, date, isPosted,
                invoices: [], checks: [], variances: [],
                totalSettled: 0, totalChecks: 0, netVariance: 0
            };
        }
    };

    reportData.invoiceBreakdown.forEach(inv => {
        ensurePouch(inv.docNo, inv.date, inv.isPosted);
        pouchMap[inv.docNo].invoices.push(inv);
        pouchMap[inv.docNo].totalSettled += inv.amountApplied;
    });

    reportData.checkBreakdown.forEach(chk => {
        ensurePouch(chk.docNo, chk.date, chk.isPosted);
        pouchMap[chk.docNo].checks.push(chk);
        pouchMap[chk.docNo].totalChecks += chk.amount;
    });

    reportData.varianceBreakdown.forEach(v => {
        ensurePouch(v.docNo, v.date, v.isPosted);
        pouchMap[v.docNo].variances.push(v);
        if (v.type.includes("Shortage")) {
            pouchMap[v.docNo].netVariance -= v.amount;
        } else {
            pouchMap[v.docNo].netVariance += v.amount;
        }
    });

    // Return sorted by date (newest first)
    return Object.values(pouchMap).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};