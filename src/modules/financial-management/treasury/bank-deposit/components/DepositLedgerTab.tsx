"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ChevronDown, ChevronUp, AlertCircle, Banknote, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BankDepositClientService } from "../services/bankDepositClientService";
import { DepositSlip } from "../types";

interface Props {
    history: DepositSlip[];
    isLoading: boolean;
    isSubmitting: boolean;
    onClear: (id: number) => Promise<void>;
    fetchData: () => void;
}

export function DepositLedgerTab({ history, isLoading, isSubmitting, onClear, fetchData }: Props) {
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleClear = async (id: number) => {
        if (!confirm("Confirm this deposit has cleared the bank?")) return;
        try { await onClear(id); } catch (err: unknown) { alert(err instanceof Error ? err.message : 'An unknown error occurred'); }
    };

    const handleBounce = async (detailId: number, checkNo: string) => {
        const remarks = prompt(`Enter reason for bouncing Check ${checkNo}:`, "Bounced by bank due to insufficient funds");
        if (!remarks) return; // User cancelled

        try {
            await BankDepositClientService.bounceCheck(detailId, remarks);
            alert("Check marked as bounced! Asset has been returned to vault for re-processing.");
            fetchData(); // Refresh the ledger
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'An unknown error occurred');
        }
    };

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

    return (
        <div className="space-y-4 max-w-[1200px] mx-auto">
            {history.map((slip) => (
                <div key={slip.id} className="border rounded-lg bg-card shadow-sm overflow-hidden transition-all duration-200">

                    {/* THE HEADER ROW */}
                    <div
                        className="p-4 flex justify-between items-center cursor-pointer hover:bg-muted/30"
                        onClick={() => setExpandedId(expandedId === slip.id ? null : slip.id)}
                    >
                        <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-3">
                                {expandedId === slip.id ? <ChevronUp size={18} className="text-muted-foreground"/> : <ChevronDown size={18} className="text-muted-foreground"/>}
                                <span className="font-black font-mono text-lg">{slip.depositNo}</span>
                                <Badge variant={slip.status === "CLEARED" ? "default" : "outline"} className={slip.status === "CLEARED" ? "bg-emerald-600" : ""}>
                                    {slip.status}
                                </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold ml-7">
                                Prepared by {slip.preparedBy} on {new Date(slip.datePrepared).toLocaleDateString()}
                            </p>
                        </div>

                        <div className="text-right flex items-center gap-8">
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-muted-foreground">Grand Total</p>
                                <p className="font-black text-xl text-primary">₱{slip.grandTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</p>
                            </div>

                            {slip.status === "PREPARED" && (
                                <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 font-bold uppercase text-[10px]"
                                    onClick={(e) => { e.stopPropagation(); handleClear(slip.id); }}
                                    disabled={isSubmitting}
                                >
                                    <CheckCircle2 size={14} className="mr-2"/> Clear Deposit
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* THE EXPANDED LINE ITEMS */}
                    {expandedId === slip.id && (
                        <div className="bg-muted/10 border-t p-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 pl-2">Included Assets</h4>
                            <div className="bg-white rounded-md border shadow-inner overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <tr>
                                        <th className="py-2 px-4 text-left">Type</th>
                                        <th className="py-2 px-4 text-left">Bank / Check No</th>
                                        <th className="py-2 px-4 text-right">Amount</th>
                                        <th className="py-2 px-4 text-center">Status</th>
                                        <th className="py-2 px-4 text-right">Action</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                    {slip.depositedAssets?.map(asset => (
                                        <tr key={asset.detailId} className="hover:bg-muted/20">
                                            <td className="py-2 px-4">
                                                <Badge variant="outline" className={`text-[9px] uppercase ${asset.assetType === "CASH" ? "text-emerald-600 border-emerald-200" : "text-blue-600 border-blue-200"}`}>
                                                    {asset.assetType === "CASH" ? <Banknote size={10} className="mr-1"/> : <Receipt size={10} className="mr-1"/>}
                                                    {asset.assetType}
                                                </Badge>
                                            </td>
                                            <td className="py-2 px-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-xs">{asset.bankName}</span>
                                                    {asset.assetType === "CHECK" && <span className="text-[10px] font-mono text-muted-foreground">{asset.checkNo}</span>}
                                                </div>
                                            </td>
                                            <td className="py-2 px-4 text-right font-mono font-bold">
                                                ₱{asset.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="py-2 px-4 text-center">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                                        asset.status === "CLEARED" ? "bg-emerald-100 text-emerald-700" :
                                                            asset.status === "BOUNCED" ? "bg-red-100 text-red-700" :
                                                                "bg-amber-100 text-amber-700"
                                                    }`}>
                                                        {asset.status.replace("_", " ")}
                                                    </span>
                                            </td>
                                            <td className="py-2 px-4 text-right">
                                                {/* ONLY ALLOW BOUNCING IF IT IS A CHECK AND IS CURRENTLY IN TRANSIT */}
                                                {asset.assetType === "CHECK" && asset.status === "IN_TRANSIT" && slip.status === "PREPARED" && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        className="h-7 text-[10px] font-bold uppercase"
                                                        onClick={() => handleBounce(asset.detailId, asset.checkNo)}
                                                    >
                                                        <AlertCircle size={12} className="mr-1"/> Bounce
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}