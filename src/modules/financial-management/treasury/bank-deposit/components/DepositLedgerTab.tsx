"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Banknote, CheckCircle2, ChevronDown, ChevronUp, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BankDepositClientService } from "../services/bankDepositClientService";
import { ClearDepositPayload, DepositSlip } from "../types";
import { ClearDepositDialog } from "./ClearDepositDialog";

interface Props {
    history: DepositSlip[];
    isLoading: boolean;
    isSubmitting: boolean;
    onClear: (id: number, payload: ClearDepositPayload) => Promise<void>;
    fetchData: () => void;
}

function formatTimestamp(value: string | null | undefined): string {
    if (!value) return "Not recorded";

    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return "Not recorded";

    return timestamp.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function currency(value: number): string {
    return `\u20B1${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function formatStatus(status: string): string {
    return status.replace(/_/g, " ");
}

export function DepositLedgerTab({ history, isLoading, isSubmitting, onClear, fetchData }: Props) {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [clearSlip, setClearSlip] = useState<DepositSlip | null>(null);
    const [clearDialogKey, setClearDialogKey] = useState(0);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleClearSubmit = async (payload: ClearDepositPayload) => {
        if (!clearSlip) return;
        await onClear(clearSlip.id, payload);
        setClearSlip(null);
    };

    const openClearDialog = (slip: DepositSlip) => {
        setClearDialogKey((key) => key + 1);
        setClearSlip(slip);
    };

    const handleBounce = async (detailId: number, checkNo: string) => {
        const remarks = prompt(`Enter reason for bouncing Check ${checkNo}:`, "Bounced by bank due to insufficient funds");
        if (!remarks) return;

        try {
            await BankDepositClientService.bounceCheck(detailId, remarks);
            alert("Check marked as bounced! Asset has been returned to vault for re-processing.");
            fetchData();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : "An unknown error occurred");
        }
    };

    const isClearable = (status: DepositSlip["status"]) =>
        status === "PREPARED" || status === "PARTIALLY_BOUNCED";

    const badgeClassName = (status: DepositSlip["status"]) => {
        if (status === "CLEARED") return "bg-emerald-600";
        if (status === "PARTIALLY_BOUNCED") return "bg-amber-500 text-white";
        if (status === "BOUNCED") return "bg-red-600 text-white";
        return "";
    };

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></div>;

    return (
        <div className="mx-auto max-w-[1200px] space-y-4">
            {history.map((slip) => (
                <div key={slip.id} className="overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-200">
                    <div
                        className="cursor-pointer space-y-3 p-4 hover:bg-muted/30"
                        onClick={() => setExpandedId(expandedId === slip.id ? null : slip.id)}
                    >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-3">
                                    {expandedId === slip.id
                                        ? <ChevronUp size={18} className="text-muted-foreground" />
                                        : <ChevronDown size={18} className="text-muted-foreground" />}
                                    <span className="font-mono text-lg font-black">{slip.depositNo}</span>
                                    <Badge
                                        variant={slip.status === "PREPARED" ? "outline" : "default"}
                                        className={badgeClassName(slip.status)}
                                    >
                                        {formatStatus(slip.status)}
                                    </Badge>
                                </div>
                                <p className="ml-7 text-[10px] font-bold uppercase text-muted-foreground">
                                    DEPOSIT TO: {slip.targetBankAccount || "UNMAPPED RECEIVING ACCOUNT"}
                                </p>
                                <p className="ml-7 text-[10px] font-bold uppercase text-muted-foreground">
                                    BANK REF / VALIDATION NO: {slip.depositReference || "Not recorded"}
                                    {slip.validationDocumentFileId && (
                                        <a
                                            className="ml-2 text-primary underline underline-offset-2"
                                            href={`/api/fm/treasury/bank-deposits/attachments/${encodeURIComponent(slip.validationDocumentFileId)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            View Slip Attachment
                                        </a>
                                    )}
                                </p>
                                <p className="ml-7 text-[10px] font-bold uppercase text-muted-foreground">
                                    PREPARED BY {slip.preparedBy || "Not recorded"} ON {formatTimestamp(slip.datePrepared)}
                                    {slip.status === "CLEARED" && (
                                        <> | CLEARED BY {slip.clearedBy || "Not recorded"} ON {formatTimestamp(slip.clearedAt)}</>
                                    )}
                                </p>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-4 text-right">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground">Grand Total</p>
                                    <p className="text-xl font-black text-primary">{currency(slip.grandTotal)}</p>
                                </div>
                                {isClearable(slip.status) && (
                                    <Button
                                        size="sm"
                                        className="bg-emerald-600 font-bold uppercase text-[10px] hover:bg-emerald-700"
                                        onClick={(event) => { event.stopPropagation(); openClearDialog(slip); }}
                                        disabled={isSubmitting}
                                    >
                                        <CheckCircle2 size={14} className="mr-2" /> Clear Deposit
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {expandedId === slip.id && (
                        <div className="border-t bg-muted/10 p-4">
                            <h4 className="mb-3 pl-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                Included Assets
                            </h4>
                            <div className="overflow-x-auto rounded-md border bg-white shadow-inner">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Type</th>
                                        <th className="px-4 py-2 text-left">Source Doc</th>
                                        <th className="px-4 py-2 text-left">Bank / Check #</th>
                                        <th className="px-4 py-2 text-left">Check Date</th>
                                        <th className="px-4 py-2 text-right">Amount</th>
                                        <th className="px-4 py-2 text-center">Status</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                    {slip.depositedAssets?.map((asset) => (
                                        <tr key={asset.detailId} className="hover:bg-muted/20">
                                            <td className="px-4 py-2">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[9px] uppercase ${asset.assetType === "CASH"
                                                        ? "border-emerald-200 text-emerald-600"
                                                        : "border-blue-200 text-blue-600"}`}
                                                >
                                                    {asset.assetType === "CASH"
                                                        ? <Banknote size={10} className="mr-1" />
                                                        : <Receipt size={10} className="mr-1" />}
                                                    {asset.assetType}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className="font-mono text-xs font-bold text-primary">
                                                    {asset.documentNumber || "-"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold">{asset.bankName}</span>
                                                    {asset.assetType === "CHECK" && (
                                                        <span className="font-mono text-[10px] text-muted-foreground">{asset.checkNo}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-left">
                                                <span className="font-mono text-xs">
                                                    {asset.assetType === "CHECK" && asset.chequeDate
                                                        ? asset.chequeDate.slice(0, 10)
                                                        : "N/A"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono font-bold">{currency(asset.amount)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                                                        asset.status === "CLEARED" ? "bg-emerald-100 text-emerald-700" :
                                                            asset.status === "BOUNCED" ? "bg-red-100 text-red-700" :
                                                                "bg-amber-100 text-amber-700"
                                                    }`}>
                                                        {asset.status.replace("_", " ")}
                                                    </span>
                                                    {asset.assetType === "CHECK" && asset.status === "IN_TRANSIT" && isClearable(slip.status) && (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="h-7 text-[10px] font-bold uppercase"
                                                            onClick={() => handleBounce(asset.detailId, asset.checkNo)}
                                                        >
                                                            <AlertCircle size={12} className="mr-1" /> Bounce
                                                        </Button>
                                                    )}
                                                </div>
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

            <ClearDepositDialog
                key={`${clearSlip?.id ?? "closed"}-${clearDialogKey}`}
                open={clearSlip !== null}
                slip={clearSlip}
                isSubmitting={isSubmitting}
                onOpenChange={(open) => { if (!open && !isSubmitting) setClearSlip(null); }}
                onSubmit={handleClearSubmit}
            />
        </div>
    );
}
