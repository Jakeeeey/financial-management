"use client";

import React, { useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import { useCollectionReport } from "../hooks/useCollectionReport";
import { generateCollectionPDF } from "../utils/pdf-generator";
import { exportCollectionReportToExcel } from "../utils/exportUtils";

// Sub-components
import { ReportHeader } from "./ReportHeader";
import { KpiCards } from "./KpiCards";
import { DepositsTable, VariancesTable } from "./AssetTables";
import { LedgerTable } from "./LedgerTable";

export default function CollectionSummaryDashboard() {
    const {
        reportData, isLoading,
        startDate, setStartDate,
        endDate, setEndDate,
        fetchReport
    } = useCollectionReport();

    // Export Handlers
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrintPDF = () => {
        if (reportData) generateCollectionPDF(reportData, startDate, endDate);
    };
    const handleExportExcel = () => {
        if (reportData) exportCollectionReportToExcel(reportData, startDate, endDate);
    };

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    return (
        <div className="h-full flex flex-col space-y-4">
            <ReportHeader
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                isLoading={isLoading} hasData={!!reportData}
                onGenerate={fetchReport}
                onExportExcel={handleExportExcel}
                onPrint={() => handlePrintPDF()}
            />

            <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div className="p-1 h-full" ref={printRef}>

                    {!reportData && !isLoading && (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                            <FileText size={48} className="mb-4 opacity-50"/>
                            <p className="font-black tracking-widest uppercase text-sm text-foreground">No Report Generated</p>
                        </div>
                    )}

                    {isLoading && !reportData && (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                            <span className="animate-pulse font-black tracking-widest uppercase text-sm">Aggregating Ledger...</span>
                        </div>
                    )}

                    {reportData && (
                        <div className="space-y-4 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <KpiCards data={reportData} />

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                    <DepositsTable checks={reportData.checkBreakdown} />
                                    <VariancesTable variances={reportData.varianceBreakdown} />
                                </div>

                                <div className="h-full">
                                    <LedgerTable
                                        invoices={reportData.invoiceBreakdown}
                                        totalCleared={reportData.totalInvoicesCleared}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}