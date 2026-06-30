"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { SearchableDropdown } from "./SearchableDropdown";
import { StickyTableWrapper } from "./StickyTableWrapper";
import { PaymentLine, BankAccountDto } from "../types";

interface PaymentsSectionProps {
    payments: PaymentLine[];
    setPayments: (val: PaymentLine[]) => void;
    bankAccounts: BankAccountDto[];
    handleAddPayment: () => void;
    handleRemovePayment: (idx: number) => void;
    totalPayments: number;
    formatMoney: (amount: number) => string;
    disabled?: boolean;
    isAddDisabled?: boolean;
}

export function PaymentsSection({
    payments,
    setPayments,
    bankAccounts,
    handleAddPayment,
    handleRemovePayment,
    totalPayments,
    formatMoney,
    disabled = false,
    isAddDisabled = false
}: PaymentsSectionProps) {
    return (
        <div className="bg-card rounded-sm border border-border shadow-sm overflow-hidden text-foreground">
            <div className="bg-muted px-4 py-2.5 border-b border-border flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary"/>
                <span className="text-xs font-bold text-foreground">Payment details (Check / Cash distribution)</span>
                <span className="ml-auto text-[10px] font-semibold text-muted-foreground uppercase">{payments.length} row{payments.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="p-0.5">
                <StickyTableWrapper className="max-h-[300px] overflow-auto custom-scrollbar border-b border-border">
                    <Table className="border-collapse">
                        <TableHeader className="bg-muted sticky top-0 z-10 border-b border-border">
                            <TableRow className="border-border">
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[120px]">Check / Reference No</TableHead>
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[110px]">Payment Date</TableHead>
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[200px]">Bank / Cash Account</TableHead>
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[180px]">Memo Description</TableHead>
                                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 w-[120px] text-right">Amount</TableHead>
                                <TableHead className="w-[40px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border bg-card">
                            {payments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                                        No check or cash lines added. Click &quot;Add check line&quot; to allocate.
                                    </TableCell>
                                </TableRow>
                            ) : payments.map((p, i) => (
                                <TableRow key={i} className="hover:bg-muted/40 border-b border-border">
                                    {/* Check No */}
                                    <TableCell className="p-1 align-middle">
                                        <Input 
                                            disabled={disabled}
                                            className="h-7 text-xs uppercase bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background focus:ring-0 focus-visible:ring-0 shadow-none px-2 rounded-sm transition-all font-bold disabled:bg-transparent disabled:cursor-not-allowed text-foreground"
                                            placeholder="Check #" 
                                            value={p.checkNo || ""}
                                            onChange={e => {
                                                const n = [...payments];
                                                n[i].checkNo = e.target.value;
                                                setPayments(n);
                                            }}
                                        />
                                    </TableCell>
                                    
                                    {/* Date */}
                                    <TableCell className="p-1 align-middle">
                                        <Input 
                                            type="date" 
                                            disabled={disabled}
                                            className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background focus:ring-0 focus-visible:ring-0 shadow-none px-2 rounded-sm transition-all disabled:bg-transparent disabled:cursor-not-allowed text-foreground"
                                            value={p.date ? p.date.split('T')[0] : ""}
                                            onChange={e => {
                                                const n = [...payments];
                                                n[i].date = e.target.value;
                                                setPayments(n);
                                            }}
                                        />
                                    </TableCell>
                                    
                                    {/* Bank Account */}
                                    <TableCell className="p-1 align-middle">
                                        <SearchableDropdown<number>
                                            options={bankAccounts.map((b) => ({
                                                value: b.bankId ?? 0,
                                                label: `${b.bankName || 'Unknown Bank'} - ${b.accountNumber || 'NO-ACCT'}`
                                            }))}
                                            value={p.bankId || ""}
                                            onSelect={(val) => {
                                                const n = [...payments];
                                                n[i].bankId = val;
                                                // Auto-fill account title from selection
                                                const matched = bankAccounts.find(x => x.bankId === val);
                                                if (matched) {
                                                    n[i].accountTitle = `${matched.bankName} - ${matched.accountNumber}`;
                                                }
                                                setPayments(n);
                                            }}
                                            placeholder="Choose Cash/Bank..."
                                            disabled={disabled}
                                            className="h-7 w-full bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background text-xs rounded-sm shadow-none px-2 text-foreground disabled:opacity-50"
                                            popoverWidth="w-[350px]"
                                        />
                                    </TableCell>
                                    
                                    {/* Remarks */}
                                    <TableCell className="p-1 align-middle">
                                        <Input 
                                            disabled={disabled}
                                            className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background focus:ring-0 focus-visible:ring-0 shadow-none px-2 rounded-sm transition-all disabled:bg-transparent disabled:cursor-not-allowed text-foreground"
                                            placeholder="Line payment info..." 
                                            value={p.remarks || ""}
                                            onChange={e => {
                                                const n = [...payments];
                                                n[i].remarks = e.target.value;
                                                setPayments(n);
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
                                                const n = [...payments];
                                                n[i].amount = e.target.value === "" ? 0 : Number(e.target.value);
                                                setPayments(n);
                                            }}
                                        />
                                    </TableCell>
                                    
                                    {/* Delete Row */}
                                    <TableCell className="p-1 text-center align-middle">
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={() => handleRemovePayment(i)}
                                            disabled={payments.length <= 1 || disabled}
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

                {/* Subtotal and actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 gap-2 bg-muted/30 border-t border-border">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleAddPayment}
                        disabled={disabled || isAddDisabled}
                        title={isAddDisabled ? "Select Division and Department first" : "Add check line"}
                        className="text-xs font-semibold border-border text-primary hover:bg-accent hover:text-accent-foreground bg-background rounded-sm h-7 disabled:opacity-50"
                    >
                        <Plus className="w-3.5 h-3.5 mr-1.5"/> Add check line
                    </Button>
                    
                    <div className="text-sm font-bold text-foreground self-end sm:self-auto pr-8">
                        <span>Total Payments (Credits): </span>
                        <span className="text-base text-primary ml-1">{formatMoney(totalPayments)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
