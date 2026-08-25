"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
    ArrowRightCircle,
    FileText,
    Loader2,
    Wallet,
    Check,
    ChevronsUpDown,
    Hash,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VaultAsset, ActiveBankAccount } from "../types";
import { cn } from "@/lib/utils";

interface Props {
    vaultAssets: VaultAsset[];
    activeBanks: ActiveBankAccount[];
    isLoading: boolean;
    isSubmitting: boolean;
    page: number;
    totalPages: number;
    totalElements: number;
    pageSize: number;
    onPrepare: (assetIds: number[], targetBankId: number, remarks: string) => Promise<{ depositNo: string }>;
    fetchData: () => void;
    fetchPage: (page: number, search?: string) => void; // 🚀 Updated to accept search
}

export function PrepareDepositTab({
                                      vaultAssets,
                                      activeBanks,
                                      isLoading,
                                      isSubmitting,
                                      page,
                                      totalPages,
                                      totalElements,
                                      pageSize,
                                      onPrepare,
                                      fetchData,
                                      fetchPage
                                  }: Props) {
    const [selectedAssets, setSelectedAssets] = useState<VaultAsset[]>([]);
    const [targetBankId, setTargetBankId] = useState<string>("");
    const [remarks, setRemarks] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [openBankBox, setOpenBankBox] = useState(false);

    // Initial Load
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 🚀 FIXED: Closed the useEffect properly and added the cleanup function
    useEffect(() => {
        const handler = setTimeout(() => {
            fetchPage(0, searchQuery);
        }, 500);

        return () => clearTimeout(handler);
    }, [searchQuery, fetchPage]);

    const toggleSelection = (asset: VaultAsset) => {
        setSelectedAssets(prev =>
            prev.some(a => a.detailId === asset.detailId)
                ? prev.filter(a => a.detailId !== asset.detailId)
                : [...prev, asset]
        );
    };

    // 🚀 FIXED: Removed filteredAssets completely. The backend handles filtering now!

    const summary = useMemo(() => {
        let totalCash = 0, totalChecks = 0, checkCount = 0;
        selectedAssets.forEach(asset => {
            if (asset.assetType === "CASH") totalCash += asset.amount;
            if (asset.assetType === "CHECK") {
                totalChecks += asset.amount;
                checkCount++;
            }
        });
        return { totalCash, totalChecks, grandTotal: totalCash + totalChecks, checkCount };
    }, [selectedAssets]);

    const handleGenerate = async () => {
        if (!targetBankId) return alert("Select a target bank!");
        try {
            const assetIds = selectedAssets.map(a => a.detailId);
            const slip = await onPrepare(assetIds, Number(targetBankId), remarks);
            alert(`SUCCESS! Slip ${slip.depositNo} generated.`);
            setSelectedAssets([]);
            setTargetBankId("");
            setRemarks("");
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'An unknown error occurred');
        }
    };

    // Calculate row numbers for the footer
    const startRow = totalElements === 0 ? 0 : (page * pageSize) + 1;
    const endRow = Math.min((page + 1) * pageSize, totalElements);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <Card className="xl:col-span-2 shadow-sm border-border/50 flex flex-col min-h-0">
                <CardHeader className="bg-muted/30 border-b pb-4 shrink-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                                <Wallet size={18} className="text-emerald-600" /> Office Vault
                            </CardTitle>
                        </div>
                        <Input
                            placeholder="Search server assets..."
                            className="w-64 h-9 text-xs"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-auto min-h-[500px] flex flex-col justify-between">
                    <div className="flex-1">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bank & Ref</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Check Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Collection Ref</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="animate-spin mx-auto mb-2 text-primary/50" /></TableCell></TableRow>
                                    // 🚀 FIXED: Now using vaultAssets instead of filteredAssets
                                ) : vaultAssets.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-32 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">No vault assets found.</TableCell></TableRow>
                                ) : vaultAssets.map((asset) => {
                                    const isSelected = selectedAssets.some(a => a.detailId === asset.detailId);
                                    return (
                                        <TableRow key={asset.detailId} onClick={() => toggleSelection(asset)} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(asset)} /></TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("text-[9px] uppercase font-bold", asset.assetType === 'CASH' ? 'border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-blue-500/50 text-blue-600 bg-blue-50 dark:bg-blue-900/20')}>
                                                    {asset.assetType}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-bold text-xs uppercase text-foreground">{asset.bankName || "CASH DEPOSIT"}</span><br />
                                                <span className="text-[10px] font-medium text-muted-foreground uppercase">{asset.checkNo || "BILLS & COINS"}</span>
                                            </TableCell>
                                            <TableCell>
                                                {asset.assetType === "CHECK" ? (
                                                    <Badge variant="secondary" className="text-[10px] font-mono font-bold tracking-widest">
                                                        {asset.chequeDate ? asset.chequeDate : "N/A"}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground/30 text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <Hash className="w-3 h-3 text-muted-foreground/50" />
                                                    <span className="font-mono font-bold text-xs text-primary">{asset.sourcePouchNo}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-sm text-foreground tracking-tight">
                                                ₱{asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="border-t bg-muted/10 p-3 px-5 flex items-center justify-between">
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                            Showing {startRow} to {endRow} of {totalElements} entries
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
                            </span>
                            <div className="flex items-center gap-1">
                                {/* 🚀 FIXED: Passed searchQuery to fetchPage so search state is kept across pages */}
                                <Button
                                    variant="outline" size="sm" className="h-8 w-8 p-0"
                                    disabled={page === 0 || isLoading}
                                    onClick={() => fetchPage(page - 1, searchQuery)}
                                >
                                    <ChevronLeft size={16} />
                                </Button>
                                <Button
                                    variant="outline" size="sm" className="h-8 w-8 p-0"
                                    disabled={page >= totalPages - 1 || isLoading}
                                    onClick={() => fetchPage(page + 1, searchQuery)}
                                >
                                    <ChevronRight size={16} />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-primary/20 xl:sticky xl:top-2">
                <CardHeader className="bg-primary/5 border-b pb-4">
                    <CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary">
                        <FileText size={18} /> Builder
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-3 bg-muted/30 p-4 rounded-xl border">
                        <div className="flex justify-between font-mono font-black text-2xl text-primary">
                            <span>Total</span><span>₱{summary.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                            <span>{summary.checkCount} Check(s)</span>
                            <span>Cash: ₱{summary.totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="space-y-4">

                        <Popover open={openBankBox} onOpenChange={setOpenBankBox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openBankBox}
                                    className={cn(
                                        "w-full justify-between font-bold text-xs h-10 uppercase",
                                        !targetBankId && "text-muted-foreground"
                                    )}
                                >
                                    {targetBankId
                                        ? activeBanks.find((b) => b.bankId.toString() === targetBankId)?.displayName
                                        : "Select receiving account..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0 sm:w-[350px]">
                                <Command>
                                    <CommandInput placeholder="Search bank accounts..." className="uppercase text-xs font-bold" />
                                    <CommandList className="custom-scrollbar">
                                        <CommandEmpty className="text-xs font-bold uppercase p-4 text-center text-muted-foreground">
                                            No bank found.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {activeBanks.map((b) => (
                                                <CommandItem
                                                    key={b.bankId}
                                                    value={b.displayName}
                                                    onSelect={() => {
                                                        setTargetBankId(b.bankId.toString());
                                                        setOpenBankBox(false);
                                                    }}
                                                    className="font-bold uppercase text-xs cursor-pointer"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4 text-primary",
                                                            targetBankId === b.bankId.toString() ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {b.displayName}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        <Textarea
                            placeholder="Remarks / Deposit Reference..."
                            className="text-xs font-medium resize-none h-20"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>
                    <Button
                        className="w-full font-black uppercase text-xs h-12 shadow-md transition-all active:scale-95"
                        onClick={handleGenerate}
                        disabled={selectedAssets.length === 0 || isSubmitting}
                    >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin mr-2" /> : <ArrowRightCircle size={18} className="mr-2" />}
                        Generate Deposit Slip ({selectedAssets.length})
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}