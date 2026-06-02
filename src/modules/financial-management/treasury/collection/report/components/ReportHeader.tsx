import React from "react";
import { CalendarDays, Search, Printer, Download, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ReportHeaderProps {
    startDate: string; setStartDate: (v: string) => void;
    endDate: string; setEndDate: (v: string) => void;
    isLoading: boolean;
    hasData: boolean;
    onGenerate: () => void;
    onExportExcel: () => void;
    onPrint: () => void;
}

export function ReportHeader({
                                 startDate, setStartDate, endDate, setEndDate,
                                 isLoading, hasData, onGenerate, onExportExcel, onPrint
                             }: ReportHeaderProps) {
    return (
        <div className="bg-card border border-border p-3 rounded-xl shadow-sm flex flex-wrap gap-3 items-center justify-between shrink-0 relative overflow-hidden z-10">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <div className="flex items-center gap-3">
                <h1 className="text-lg font-black flex items-center gap-2 pl-2">
                    <Scale className="text-primary" size={18}/> Collection Summary
                </h1>
                <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-md p-1 ml-4 focus-within:ring-1 ring-primary transition-all">
                    <div className="flex items-center gap-1.5 px-2 cursor-pointer">
                        <CalendarDays size={14} className="text-muted-foreground" />
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-7 w-[120px] text-xs font-bold border-none shadow-none bg-transparent cursor-pointer" />
                    </div>
                    <span className="text-muted-foreground text-xs font-black">TO</span>
                    <div className="flex items-center gap-1.5 px-2 cursor-pointer">
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-7 w-[120px] text-xs font-bold border-none shadow-none bg-transparent cursor-pointer" />
                    </div>
                </div>
                <Button onClick={onGenerate} disabled={isLoading} size="sm" className="h-9 text-xs font-black tracking-widest uppercase shadow-sm active:scale-95 transition-transform">
                    <Search size={14} className={`mr-1.5 ${isLoading ? "animate-spin" : ""}`}/> {isLoading ? "Crunching..." : "Generate"}
                </Button>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={onExportExcel} disabled={!hasData} variant="outline" size="sm" className="h-9 text-xs font-black tracking-widest uppercase border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:scale-95 transition-all">
                    <Download size={14} className="mr-1.5"/> Excel
                </Button>
                <Button onClick={onPrint} disabled={!hasData} variant="default" size="sm" className="h-9 text-xs font-black tracking-widest uppercase bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95 transition-all">
                    <Printer size={14} className="mr-1.5"/> Print Report
                </Button>
            </div>
        </div>
    );
}