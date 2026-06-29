"use client";

import React, { useEffect, useState, useMemo } from "react";
import { FileText, Eye, Search, Filter } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useCollectionReport, PouchReportDto } from "../hooks/useCollectionReport";
import { ReportHeader } from "./ReportHeader";
import { KpiCards } from "./KpiCards";
import { PouchDetailSheet } from "./PouchDetailSheet";
import { exportCollectionReportToExcel } from "../utils/exportUtils";
import { generateCollectionPDF } from "../utils/pdf-generator";

export default function CollectionSummaryDashboard() {
    const { reportData, isLoading, startDate, setStartDate, endDate, setEndDate, fetchReport } = useCollectionReport();
    const [selectedPouch, setSelectedPouch] = useState<PouchReportDto | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const filteredPouches = useMemo(() => {
        if (!reportData?.pouches) return [];
        return reportData.pouches.filter(pouch => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch =
                pouch.docNo.toLowerCase().includes(searchLower) ||
                pouch.invoices.some(inv => inv.customerName.toLowerCase().includes(searchLower)) ||
                pouch.checks.some(chk => chk.customerName.toLowerCase().includes(searchLower));

            const matchesStatus = statusFilter === "ALL" || (statusFilter === "POSTED" ? pouch.isPosted : !pouch.isPosted);

            return matchesSearch && matchesStatus;
        });
    }, [reportData, searchQuery, statusFilter]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    return (
        // 🚀 1. Make the outer wrapper fixed height so we can scroll internally
        <div className="h-full flex flex-col space-y-5 overflow-hidden">

            {/* The Top Header stays static */}
            <div className="shrink-0">
                <ReportHeader
                    startDate={startDate} setStartDate={setStartDate}
                    endDate={endDate} setEndDate={setEndDate}
                    isLoading={isLoading} hasData={!!reportData}
                    onGenerate={fetchReport}
                    onExportExcel={() => {
                        if (reportData) {
                            exportCollectionReportToExcel(reportData, startDate, endDate);
                        }
                    }}
                    onPrint={() => {
                        if (reportData) {
                            generateCollectionPDF(reportData, startDate, endDate);
                        }
                    }}
                />
            </div>

            {/* 🚀 2. The main content area */}
            {!reportData && !isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-60">
                    <div className="p-6 bg-muted/50 rounded-full mb-4">
                        <FileText size={48} className="opacity-50 text-foreground"/>
                    </div>
                    <p className="font-bold tracking-widest uppercase text-sm text-foreground">No Report Generated</p>
                </div>
            )}

            {isLoading && !reportData && (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <span className="animate-pulse font-black tracking-widest uppercase text-sm">Aggregating Ledger...</span>
                </div>
            )}

            {reportData && (
                <div className="flex-1 flex flex-col space-y-5 min-h-0 animate-in fade-in duration-500">

                    {/* KPI Cards shrink to fit */}
                    <div className="shrink-0">
                        <KpiCards data={reportData} />
                    </div>

                    {/* 🚀 3. Master Table Card - Takes up remaining space */}
                    <Card className="flex-1 flex flex-col shadow-sm border-border/60 rounded-2xl overflow-hidden bg-background">

                        {/* 🚀 4. NEW HORIZONTAL FILTER TOOLBAR */}
                        <div className="shrink-0 p-3 bg-muted/10 border-b border-border/50 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="relative w-[300px]">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search PP# / CP# / Customer..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-9 text-xs rounded-lg bg-background border-border/60 shadow-sm"
                                    />
                                </div>
                                <div className="w-[150px]">
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="h-9 text-xs rounded-lg font-bold bg-background shadow-sm border-border/60">
                                            <SelectValue placeholder="All Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL" className="text-xs font-bold">All Status</SelectItem>
                                            <SelectItem value="POSTED" className="text-xs font-bold text-emerald-500">Posted</SelectItem>
                                            <SelectItem value="DRAFT" className="text-xs font-bold text-orange-500">Draft</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-bold gap-2 text-muted-foreground border-border/60 shadow-sm bg-background">
                                <Filter size={14} /> Advanced Filters
                            </Button>
                        </div>

                        {/* 🚀 5. THE SCROLLABLE TABLE AREA WITH STICKY HEADER */}
                        <div className="flex-1 overflow-auto relative scrollbar-thin">
                            <table className="text-xs w-full border-collapse">
                                {/* 🚀 The sticky top-0 ensures this never leaves the view while scrolling */}
                                <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm shadow-sm">
                                    <tr className="border-b border-border/50">
                                        <th className="pl-6 h-11 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-left">Doc No.</th>
                                        <th className="h-11 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-left">Date</th>
                                        <th className="h-11 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-left">Status</th>
                                        <th className="text-right h-11 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Total Cash</th>
                                        <th className="text-right h-11 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Total Checks</th>
                                        <th className="text-right h-11 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Net Variance</th>
                                        <th className="text-right bg-primary/5 text-primary h-11 font-bold uppercase tracking-wider text-[10px]">Net Invoices</th>
                                        <th className="text-center w-[100px] pr-6 h-11 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPouches.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center italic text-muted-foreground py-12 text-sm">No pouches found matching your filters.</td></tr>
                                    ) : filteredPouches.map((pouch) => {
                                        const netVariance = pouch.overage - pouch.shortage;
                                        return (
                                            <tr key={pouch.docNo} className="hover:bg-muted/40 transition-colors group cursor-pointer border-b border-border/50" onClick={() => setSelectedPouch(pouch)}>
                                                <td className="font-bold text-foreground font-mono pl-6 py-3">{pouch.docNo}</td>
                                                <td className="font-medium text-muted-foreground">{pouch.date ? format(parseISO(pouch.date), "MMM dd, yyyy") : 'N/A'}</td>
                                                <td>
                                                    {pouch.isPosted ? (
                                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">POSTED</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">DRAFT</Badge>
                                                    )}
                                                </td>
                                                <td className="text-right font-mono font-medium text-foreground">₱{pouch.totalCash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="text-right font-mono font-medium text-blue-500">{pouch.totalCheck > 0 ? `₱${pouch.totalCheck.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}</td>
                                                <td className="text-right font-mono font-bold">
                                                    {netVariance === 0 ? '-' : (
                                                        <span className={netVariance < 0 ? 'text-red-500' : 'text-purple-500'}>
                                                            {netVariance < 0 ? '-' : '+'}₱{Math.abs(netVariance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-right font-mono font-black text-primary bg-primary/5">₱{pouch.invoiceNetTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="text-center pr-6">
                                                    <Button size="sm" variant="ghost" className="h-7 rounded-md px-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                                        <Eye size={14} className="mr-1.5"/> Review
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            <PouchDetailSheet pouch={selectedPouch} isOpen={!!selectedPouch} onClose={() => setSelectedPouch(null)} />
        </div>
    );
}