"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { SearchableDropdown } from "./SearchableDropdown";
import { StickyTableWrapper } from "./StickyTableWrapper";
import { PayableLine, COADto, DivisionDto } from "../types";
import { isInheritedVatSplitLine, updateVatSplitDivision } from "@/modules/financial-management/treasury/components/payable-line-splits";

interface PayablesSectionProps {
    payables: PayableLine[];
    setPayables: (val: PayableLine[]) => void;
    coas: COADto[];
    divisions: DivisionDto[];
    isPayableOrExpenseCOA: (c: COADto) => boolean;
    totalAmount: number;
    payeeId: number | "";
    handleAddPayable: () => void;
    handleOpenMemoModal: () => void;
    handleRemovePayable: (idx: number) => void;
    formatMoney: (amount: number) => string;
    disabled?: boolean;
    isAddDisabled?: boolean;
}

export function PayablesSection({
    payables,
    setPayables,
    coas,
    divisions,
    isPayableOrExpenseCOA,
    totalAmount,
    payeeId,
    handleAddPayable,
    handleOpenMemoModal,
    handleRemovePayable,
    formatMoney,
    disabled = false,
    isAddDisabled = false
}: PayablesSectionProps) {
    return (
        <div className="bg-card rounded-sm border border-border shadow-sm overflow-hidden text-foreground">
            <div className="bg-muted px-4 py-2.5 border-b border-border flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary"/>
                <span className="text-xs font-bold text-foreground">Category details (Expense / Liability allocations)</span>
                <span className="ml-auto text-[10px] font-semibold text-muted-foreground uppercase">{payables.length} row{payables.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="p-0.5">
                <StickyTableWrapper className="max-h-[320px] overflow-auto custom-scrollbar border-b border-border">
                    <Table className="border-collapse">
                        <TableHeader className="bg-muted sticky top-0 z-10 border-b border-border">
                            <TableRow className="border-border">
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[120px]">Bill / Ref No</TableHead>
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[200px]">Chart of Account (Category)</TableHead>
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[125px]">Division</TableHead>
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[180px]">Memo Description</TableHead>
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 w-[120px] text-right">Amount</TableHead>
                                <TableHead className="w-[40px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border bg-card">
                            {payables.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                                        No distribution lines added. Click &quot;Add line&quot; to allocate.
                                    </TableCell>
                                </TableRow>
                            ) : payables.map((p, i) => (
                                <TableRow key={i} className="hover:bg-muted/40 border-b border-border">
                                    {/* Ref No */}
                                    <TableCell className="p-1 align-middle">
                                        <Input 
                                            disabled={disabled}
                                            className="h-7 text-xs uppercase bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background focus:ring-0 focus-visible:ring-0 shadow-none px-2 rounded-sm transition-all disabled:bg-transparent disabled:cursor-not-allowed text-foreground"
                                            placeholder="e.g. Invoice #" 
                                            value={p.referenceNo || ""}
                                            onChange={e => {
                                                const n = [...payables];
                                                n[i].referenceNo = e.target.value;
                                                setPayables(n);
                                            }}
                                        />
                                    </TableCell>
                                    
                                    {/* Chart of Account */}
                                    <TableCell className="p-1 align-middle">
                                        <SearchableDropdown<number>
                                            options={coas.filter(isPayableOrExpenseCOA).map((c) => ({
                                                value: c.coaId ?? 0,
                                                label: `${c.glCode || 'NO-CODE'} - ${c.accountTitle || 'Unknown'}`
                                            }))}
                                            value={p.coaId || ""}
                                            onSelect={(val) => {
                                                const n = [...payables];
                                                n[i].coaId = val;
                                                setPayables(n);
                                            }}
                                            placeholder="Choose Category GL..."
                                            disabled={disabled}
                                            className="h-7 w-full bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background text-xs rounded-sm shadow-none px-2 text-foreground disabled:opacity-50"
                                            popoverWidth="w-[380px]"
                                        />
                                    </TableCell>
                                    
                                    {/* Division */}
                                    <TableCell className="p-1 align-middle">
                                        <select
                                            disabled={disabled || isInheritedVatSplitLine(payables, i)}
                                            className="h-7 w-full bg-transparent border border-transparent hover:border-input focus:border-primary focus:bg-background rounded-sm text-xs px-2 focus:outline-none transition-all disabled:bg-transparent disabled:cursor-not-allowed text-foreground"
                                            value={p.divisionId || ""}
                                            onChange={e => setPayables(updateVatSplitDivision(
                                                payables,
                                                i,
                                                e.target.value ? Number(e.target.value) : undefined,
                                            ))}
                                        >
                                            <option value="">(Select Division)</option>
                                            {divisions.map(d => (
                                                <option key={d.divisionId} value={d.divisionId}>
                                                    {d.divisionName}
                                                </option>
                                            ))}
                                        </select>
                                    </TableCell>
                                    
                                    {/* Remarks */}
                                    <TableCell className="p-1 align-middle">
                                        <Input 
                                            disabled={disabled}
                                            className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background focus:ring-0 focus-visible:ring-0 shadow-none px-2 rounded-sm transition-all disabled:bg-transparent disabled:cursor-not-allowed text-foreground"
                                            placeholder="Line item description..." 
                                            value={p.remarks || ""}
                                            onChange={e => {
                                                const n = [...payables];
                                                n[i].remarks = e.target.value;
                                                setPayables(n);
                                            }}
                                        />
                                    </TableCell>
                                    
                                    {/* Amount */}
                                    <TableCell className="p-1 align-middle">
                                        <Input 
                                            type="number" 
                                            disabled={disabled}
                                            className="h-7 text-xs font-bold text-right bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background focus:ring-0 focus-visible:ring-0 shadow-none px-2 rounded-sm transition-all disabled:bg-transparent disabled:cursor-not-allowed text-foreground"
                                            placeholder="0.00" 
                                            value={p.amount || ""}
                                            onChange={e => {
                                                const n = [...payables];
                                                n[i].amount = e.target.value === "" ? 0 : Number(e.target.value);
                                                setPayables(n);
                                            }}
                                        />
                                    </TableCell>
                                    
                                    {/* Delete Row */}
                                    <TableCell className="p-1 text-center align-middle">
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={() => handleRemovePayable(i)}
                                            disabled={payables.length <= 1 || disabled}
                                            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-sm disabled:opacity-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </StickyTableWrapper>

                {/* Ledger actions and subtotal */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 gap-2 bg-muted/30 border-t border-border">
                    <div className="flex gap-2">
                        <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleAddPayable}
                            disabled={disabled || isAddDisabled}
                            title={isAddDisabled ? "Select Division and Department first" : "Add allocation line"}
                            className="text-xs font-semibold border-border text-primary hover:bg-accent hover:text-accent-foreground bg-background rounded-sm h-7 disabled:opacity-50"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1.5"/> Add allocation line
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline" 
                            type="button" 
                            onClick={handleOpenMemoModal} 
                            disabled={!payeeId || disabled || isAddDisabled}
                            title={isAddDisabled ? "Select Division and Department first" : "Apply credit / debit memo"}
                            className="text-xs font-semibold border-border text-purple-600 hover:bg-accent rounded-sm h-7 disabled:opacity-50"
                        >
                            Apply credit / debit memo
                        </Button>
                    </div>
                    
                    <div className="text-sm font-bold text-foreground self-end sm:self-auto pr-8">
                        <span>Total Allocations (Debits): </span>
                        <span className="text-base text-primary ml-1">{formatMoney(totalAmount)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
