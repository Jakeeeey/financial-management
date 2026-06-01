import React from "react";
import { Banknote, Landmark, FileText, Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CollectionSummaryReportDto } from "../hooks/useCollectionReport";

export function KpiCards({ data }: { data: CollectionSummaryReportDto }) {
    const netVariance = (data.totalOverages || 0) - (data.totalShortages || 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-[4px] border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Banknote size={12} className="text-emerald-500"/> Total Physical Cash</span>
                    <span className="text-2xl font-black font-mono">₱{data.totalPhysicalCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </CardContent>
            </Card>
            <Card className="border-l-[4px] border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Landmark size={12} className="text-blue-500"/> Total Checks</span>
                    <span className="text-2xl font-black font-mono">₱{data.totalChecks.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </CardContent>
            </Card>
            <Card className="border-l-[4px] border-l-teal-500 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><FileText size={12} className="text-teal-500"/> EWT Collected</span>
                    <span className="text-2xl font-black font-mono text-teal-600">₱{data.totalEwt.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </CardContent>
            </Card>
            <Card className={`border-l-[4px] shadow-sm hover:shadow-md transition-shadow ${netVariance < 0 ? 'border-l-red-500 bg-red-50/30' : netVariance > 0 ? 'border-l-purple-500 bg-purple-50/30' : 'border-l-muted'}`}>
                <CardContent className="p-4 flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Scale size={12}/> Net Variance</span>
                    <span className={`text-2xl font-black font-mono ${netVariance < 0 ? 'text-red-600' : netVariance > 0 ? 'text-purple-600' : 'text-foreground'}`}>
                        {netVariance < 0 ? '-' : netVariance > 0 ? '+' : ''}₱{Math.abs(netVariance).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                </CardContent>
            </Card>
        </div>
    );
}