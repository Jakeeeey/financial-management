"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ArrowRightCircle, FileText, Loader2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VaultAsset, ActiveBankAccount } from "../types";

interface Props {
    vaultAssets: VaultAsset[];
    activeBanks: ActiveBankAccount[];
    isLoading: boolean;
    isSubmitting: boolean;
    onPrepare: (assetIds: number[], targetBankId: number, remarks: string) => Promise<{ depositNo: string }>;
    fetchData: () => void;
}

export function PrepareDepositTab({ vaultAssets, activeBanks, isLoading, isSubmitting, onPrepare, fetchData }: Props) {
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [targetBankId, setTargetBankId] = useState<string>("");
    const [remarks, setRemarks] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleSelection = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const filteredAssets = vaultAssets.filter(asset =>
        asset.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.checkNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.sourcePouchNo.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const summary = useMemo(() => {
        let totalCash = 0, totalChecks = 0, checkCount = 0;
        selectedIds.forEach(id => {
            const asset = vaultAssets.find(a => a.detailId === id);
            if (asset) {
                if (asset.assetType === "CASH") totalCash += asset.amount;
                if (asset.assetType === "CHECK") { totalChecks += asset.amount; checkCount++; }
            }
        });
        return { totalCash, totalChecks, grandTotal: totalCash + totalChecks, checkCount };
    }, [selectedIds, vaultAssets]);

    const handleGenerate = async () => {
        if (!targetBankId) return alert("Select a target bank!");
        try {
            const slip = await onPrepare(selectedIds, parseInt(targetBankId), remarks);
            alert(`SUCCESS! Slip ${slip.depositNo} generated.`);
            setSelectedIds([]); setTargetBankId(""); setRemarks("");
        } catch (err: unknown) { alert(err instanceof Error ? err.message : 'An unknown error occurred'); }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <Card className="xl:col-span-2 shadow-sm border-border/50 flex flex-col min-h-0">
                <CardHeader className="bg-muted/30 border-b pb-4 shrink-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Wallet size={18} className="text-emerald-600"/> Office Vault</CardTitle>
                        </div>
                        <Input placeholder="Search..." className="w-64 h-9 text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-auto max-h-[600px]">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Type</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Bank & Ref</TableHead>
                                <TableHead className="text-right text-[10px] font-black uppercase">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-48 text-center"><Loader2 className="animate-spin mx-auto mb-2 text-primary/50" /></TableCell></TableRow>
                            ) : filteredAssets.map((asset) => (
                                <TableRow key={asset.detailId} onClick={() => toggleSelection(asset.detailId)} className="cursor-pointer">
                                    <TableCell><Checkbox checked={selectedIds.includes(asset.detailId)} /></TableCell>
                                    <TableCell><Badge variant="outline" className="text-[9px] uppercase">{asset.assetType}</Badge></TableCell>
                                    <TableCell><span className="font-bold text-xs">{asset.bankName}</span><br/><span className="text-[10px] text-muted-foreground">{asset.checkNo}</span></TableCell>
                                    <TableCell className="text-right font-mono font-black text-sm">₱{asset.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-primary/20 xl:sticky xl:top-2">
                <CardHeader className="bg-primary/5 border-b pb-4">
                    <CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><FileText size={18} /> Builder</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-3 bg-muted/30 p-4 rounded-xl border">
                        <div className="flex justify-between font-mono font-black text-2xl text-primary"><span>Total</span><span>₱{summary.grandTotal.toLocaleString()}</span></div>
                    </div>
                    <div className="space-y-4">
                        <Select value={targetBankId} onValueChange={setTargetBankId}>
                            <SelectTrigger className="font-bold text-xs h-10"><SelectValue placeholder="Select receiving account" /></SelectTrigger>
                            <SelectContent>
                                {activeBanks.map(b => <SelectItem key={b.bankId} value={b.bankId.toString()}>{b.displayName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Textarea placeholder="Remarks..." className="text-xs" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    </div>
                    <Button className="w-full font-black uppercase text-xs" onClick={handleGenerate} disabled={selectedIds.length === 0 || isSubmitting}>
                        {isSubmitting ? <Loader2 size={18} className="animate-spin mr-2" /> : <ArrowRightCircle size={18} className="mr-2" />}
                        Generate Deposit Slip
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}